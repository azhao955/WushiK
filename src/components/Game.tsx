import { useState, useEffect } from 'react';
import type { Card as CardType, GameState, Player, PlayedHand } from '../types/game';
import { Card } from './Card';
import {
  createDeck,
  dealCards,
  findThreeOfSpades,
  validateHand,
  canBeatHand,
  getCardPoints,
} from '../lib/gameLogic';
import { supabase } from '../lib/supabase';

interface GameProps {
  gameId: string;
  playerId: string;
  playerName: string;
}

export function Game({ gameId, playerId, playerName }: GameProps) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [isHost, setIsHost] = useState(false);

  // Load game from Supabase and subscribe to updates
  useEffect(() => {
    loadGame();
    subscribeToGame();

    return () => {
      supabase.channel(`game-${gameId}`).unsubscribe();
    };
  }, [gameId]);

  const loadGame = async () => {
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single();

    if (error) {
      console.error('Error loading game:', error);
      // Game doesn't exist, create it if we're the first player
      await createGame();
      return;
    }

    if (data) {
      const state = data.state as GameState;

      // Check if this player is already in the game
      const existingPlayer = state.players.find(p => p.id === playerId);

      if (!existingPlayer) {
        // Add this player to the game
        await joinExistingGame(state);
      } else {
        setGameState(state);
      }
    }
  };

  const createGame = async () => {
    // Create initial game state with just this player
    const initialState: GameState = {
      id: gameId,
      players: [{
        id: playerId,
        name: playerName,
        hand: [],
        tempPoints: 0,
        totalPoints: 0,
        hasFinished: false,
      }],
      currentPlayerId: playerId,
      deck: [],
      currentHand: null,
      playedCards: [],
      passedPlayerIds: [],
      roundNumber: 1,
      targetPoints: 100,
      gameStatus: 'waiting',
    };

    const { error } = await supabase
      .from('games')
      .insert({ id: gameId, state: initialState });

    if (error) {
      console.error('Error creating game:', error);
    } else {
      setGameState(initialState);
      setIsHost(true);
      setMessage('Waiting for players to join...');
    }
  };

  const joinExistingGame = async (state: GameState) => {
    const newPlayer: Player = {
      id: playerId,
      name: playerName,
      hand: [],
      tempPoints: 0,
      totalPoints: 0,
      hasFinished: false,
    };

    const updatedState = {
      ...state,
      players: [...state.players, newPlayer],
    };

    await updateGameState(updatedState);
    setMessage(`${playerName} joined the game!`);
  };

  const startGame = async () => {
    if (!gameState || gameState.players.length < 3) {
      setMessage('Need at least 3 players to start!');
      return;
    }

    const numPlayers = gameState.players.length;
    const numDecks = Math.ceil(numPlayers / 4);
    const deck = createDeck(numDecks);
    const hands = dealCards(deck, numPlayers);

    // Find who has 3 of spades
    const firstPlayerIdx = findThreeOfSpades(hands);

    const updatedPlayers = gameState.players.map((player, idx) => ({
      ...player,
      hand: hands[idx].sort((a, b) => {
        if (a.isJoker && b.isJoker) return 0;
        if (a.isJoker) return 1;
        if (b.isJoker) return -1;
        if (a.suit !== b.suit) return a.suit!.localeCompare(b.suit!);
        return a.rank!.localeCompare(b.rank!);
      }),
    }));

    const updatedState: GameState = {
      ...gameState,
      players: updatedPlayers,
      currentPlayerId: updatedPlayers[firstPlayerIdx].id,
      gameStatus: 'playing',
      firstPlayerId: updatedPlayers[firstPlayerIdx].id,
    };

    await updateGameState(updatedState);
    setMessage(`${updatedPlayers[firstPlayerIdx].name} has 3♠ and starts!`);
  };

  const subscribeToGame = () => {
    const channel = supabase
      .channel(`game-${gameId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${gameId}`,
        },
        (payload) => {
          if (payload.new && 'state' in payload.new) {
            setGameState(payload.new.state as GameState);
          }
        }
      )
      .subscribe();

    return channel;
  };

  const updateGameState = async (newState: GameState) => {
    const { error } = await supabase
      .from('games')
      .update({ state: newState, updated_at: new Date().toISOString() })
      .eq('id', gameId);

    if (error) {
      console.error('Error updating game:', error);
    }
  };

  const getCurrentPlayer = (): Player | undefined => {
    return gameState?.players.find(p => p.id === playerId);
  };

  const isMyTurn = (): boolean => {
    return gameState?.currentPlayerId === playerId;
  };

  const toggleCardSelection = (cardId: string) => {
    setSelectedCards(prev =>
      prev.includes(cardId) ? prev.filter(id => id !== cardId) : [...prev, cardId]
    );
  };

  const handlePlay = async () => {
    if (!gameState || !isMyTurn()) return;

    const currentPlayer = getCurrentPlayer();
    if (!currentPlayer) return;

    const cards = selectedCards.map(id => currentPlayer.hand.find(c => c.id === id)!);
    const handType = validateHand(cards);

    if (!handType) {
      setMessage('Invalid hand! Please select valid cards.');
      return;
    }

    // Check if can beat current hand
    if (gameState.currentHand) {
      const newHand: PlayedHand = {
        cards,
        type: handType,
        playerId,
        playerName,
      };

      if (!canBeatHand(newHand, gameState.currentHand)) {
        setMessage('Your hand cannot beat the current hand!');
        return;
      }
    }

    // Play the hand
    await playHand(cards, handType);
  };

  const playHand = async (cards: CardType[], handType: string) => {
    if (!gameState) return;

    const newPlayers = gameState.players.map(p => {
      if (p.id === playerId) {
        return {
          ...p,
          hand: p.hand.filter(c => !cards.some(pc => pc.id === c.id)),
        };
      }
      return p;
    });

    const newPlayedCards = [...gameState.playedCards, ...cards];

    const updatedState: GameState = {
      ...gameState,
      players: newPlayers,
      currentHand: {
        cards,
        type: handType as any,
        playerId,
        playerName,
      },
      playedCards: newPlayedCards,
      passedPlayerIds: [],
      currentPlayerId: getNextPlayerId(),
    };

    await updateGameState(updatedState);
    setSelectedCards([]);
    setMessage(`You played ${handType}!`);

    // Check if player finished
    const currentPlayer = newPlayers.find(p => p.id === playerId);
    if (currentPlayer && currentPlayer.hand.length === 0) {
      handlePlayerFinished();
    }
  };

  const handlePass = async () => {
    if (!gameState || !isMyTurn()) return;

    const newPassedIds = [...gameState.passedPlayerIds, playerId];

    // Check if all other active players have passed
    const activePlayers = gameState.players.filter(p => !p.hasFinished);
    const allOthersPassedOrFinished =
      activePlayers.filter(p => p.id !== gameState.currentHand?.playerId).length ===
      newPassedIds.length;

    if (allOthersPassedOrFinished) {
      // Winner of the trick collects cards
      await collectCards();
    } else {
      const updatedState: GameState = {
        ...gameState,
        passedPlayerIds: newPassedIds,
        currentPlayerId: getNextPlayerId(),
      };
      await updateGameState(updatedState);
    }

    setMessage('You passed.');
  };

  const collectCards = async () => {
    if (!gameState || !gameState.currentHand) return;

    const winnerId = gameState.currentHand.playerId;
    const pointCards = gameState.playedCards.filter(c => getCardPoints(c) > 0);
    const points = pointCards.reduce((sum, c) => sum + getCardPoints(c), 0);

    const newPlayers = gameState.players.map(p => {
      if (p.id === winnerId) {
        return { ...p, tempPoints: p.tempPoints + points };
      }
      return p;
    });

    const updatedState: GameState = {
      ...gameState,
      players: newPlayers,
      currentHand: null,
      playedCards: [],
      passedPlayerIds: [],
      currentPlayerId: winnerId,
    };

    await updateGameState(updatedState);
    setMessage(`${gameState.currentHand.playerName} won the trick and collected ${points} points!`);
  };

  const getNextPlayerId = (): string => {
    if (!gameState) return '';

    const activePlayers = gameState.players.filter(p => !p.hasFinished);
    const currentIdx = activePlayers.findIndex(p => p.id === gameState.currentPlayerId);
    const nextIdx = (currentIdx + 1) % activePlayers.length;

    return activePlayers[nextIdx].id;
  };

  const handlePlayerFinished = () => {
    setMessage('You finished all your cards!');
  };

  if (!gameState) {
    return <div style={{ padding: '20px' }}>Loading game...</div>;
  }

  const currentPlayer = getCurrentPlayer();

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>WuShiK Card Game</h1>

      <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#ecf0f1', borderRadius: '8px' }}>
        <p><strong>Game ID:</strong> {gameId}</p>
        <p><strong>Round:</strong> {gameState.roundNumber} | <strong>Target Points:</strong> {gameState.targetPoints}</p>
        <p><strong>Status:</strong> {gameState.gameStatus}</p>
        <p><strong>Message:</strong> {message}</p>
      </div>

      {gameState.gameStatus === 'waiting' && isHost && (
        <div style={{ marginBottom: '20px' }}>
          <button
            onClick={startGame}
            style={{
              padding: '12px 24px',
              fontSize: '18px',
              backgroundColor: '#27ae60',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            Start Game ({gameState.players.length} players joined)
          </button>
        </div>
      )}

      {gameState.currentHand && (
        <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#fff3cd', borderRadius: '8px' }}>
          <h3>Current Hand ({gameState.currentHand.type}):</h3>
          <div style={{ display: 'flex', gap: '5px' }}>
            {gameState.currentHand.cards.map(card => (
              <Card key={card.id} card={card} />
            ))}
          </div>
          <p>Played by: {gameState.currentHand.playerName}</p>
        </div>
      )}

      <div style={{ marginBottom: '20px' }}>
        <h3>Players:</h3>
        {gameState.players.map(player => (
          <div
            key={player.id}
            style={{
              padding: '10px',
              marginBottom: '5px',
              backgroundColor: player.id === gameState.currentPlayerId ? '#d4edda' : '#f8f9fa',
              borderRadius: '4px',
              border: player.id === playerId ? '2px solid #3498db' : '1px solid #dee2e6',
            }}
          >
            <strong>{player.name}</strong> {player.id === playerId && '(You)'}
            {player.id === gameState.currentPlayerId && ' 👈 Current Turn'}
            <br />
            Cards: {player.hand.length} | Temp Points: {player.tempPoints} | Total: {player.totalPoints}
          </div>
        ))}
      </div>

      {currentPlayer && gameState.gameStatus === 'playing' && (
        <div>
          <h3>Your Hand:</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '15px' }}>
            {currentPlayer.hand.map(card => (
              <Card
                key={card.id}
                card={card}
                selected={selectedCards.includes(card.id)}
                onClick={() => toggleCardSelection(card.id)}
              />
            ))}
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handlePlay}
              disabled={!isMyTurn() || selectedCards.length === 0}
              style={{
                padding: '12px 24px',
                fontSize: '16px',
                backgroundColor: isMyTurn() && selectedCards.length > 0 ? '#27ae60' : '#95a5a6',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: isMyTurn() && selectedCards.length > 0 ? 'pointer' : 'not-allowed',
              }}
            >
              Play Selected Cards
            </button>

            <button
              onClick={handlePass}
              disabled={!isMyTurn() || !gameState.currentHand}
              style={{
                padding: '12px 24px',
                fontSize: '16px',
                backgroundColor: isMyTurn() && gameState.currentHand ? '#e67e22' : '#95a5a6',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: isMyTurn() && gameState.currentHand ? 'pointer' : 'not-allowed',
              }}
            >
              Pass
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
