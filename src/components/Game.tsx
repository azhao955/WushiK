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
import { getTheme } from '../lib/themes';
import { makeAIMove } from '../lib/aiPlayer';

interface GameProps {
  gameId: string;
  playerId: string;
  playerName: string;
  config?: {
    targetPoints: number;
    theme: string;
    aiPlayers: number;
    aiDifficulty: 'easy' | 'medium' | 'hard';
  };
}

export function Game({ gameId, playerId, playerName, config }: GameProps) {
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

  // Handle AI player turns
  useEffect(() => {
    if (!gameState || gameState.gameStatus !== 'playing') return;

    const currentPlayer = gameState.players.find(p => p.id === gameState.currentPlayerId);
    if (!currentPlayer || !currentPlayer.isAI) return;

    // AI player's turn - make a move after a short delay
    const timer = setTimeout(async () => {
      const aiDecision = makeAIMove(
        currentPlayer,
        gameState.currentHand,
        gameState.aiDifficulty || 'medium'
      );

      if (aiDecision.action === 'play' && aiDecision.cards) {
        const handType = validateHand(aiDecision.cards);
        if (handType) {
          await playHandForAI(currentPlayer.id, aiDecision.cards, handType);
        }
      } else {
        await handlePassForAI(currentPlayer.id);
      }
    }, 1500); // 1.5 second delay to simulate thinking

    return () => clearTimeout(timer);
  }, [gameState?.currentPlayerId, gameState?.gameStatus]);

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
    // Create initial players list with host
    const initialPlayers: Player[] = [{
      id: playerId,
      name: playerName,
      hand: [],
      tempPoints: 0,
      totalPoints: 0,
      hasFinished: false,
      isAI: false,
    }];

    // Add AI players if configured
    const numAI = config?.aiPlayers || 0;
    for (let i = 0; i < numAI; i++) {
      initialPlayers.push({
        id: `ai-${i}`,
        name: `Bot ${i + 1}`,
        hand: [],
        tempPoints: 0,
        totalPoints: 0,
        hasFinished: false,
        isAI: true,
      });
    }

    const initialState: GameState = {
      id: gameId,
      players: initialPlayers,
      currentPlayerId: playerId,
      deck: [],
      currentHand: null,
      playedCards: [],
      passedPlayerIds: [],
      roundNumber: 1,
      targetPoints: config?.targetPoints || 100,
      gameStatus: 'waiting',
      theme: config?.theme || 'default',
      aiDifficulty: config?.aiDifficulty || 'medium',
    };

    const { error } = await supabase
      .from('games')
      .insert({ id: gameId, state: initialState });

    if (error) {
      console.error('Error creating game:', error);
    } else {
      setGameState(initialState);
      setIsHost(true);
      const totalPlayers = initialPlayers.length;
      setMessage(`${totalPlayers} player${totalPlayers > 1 ? 's' : ''} in lobby. Need ${Math.max(0, 3 - totalPlayers)} more to start!`);
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
        const newHand = p.hand.filter(c => !cards.some(pc => pc.id === c.id));
        const hasFinished = newHand.length === 0;
        const finishPosition = hasFinished
          ? gameState.players.filter(pl => pl.hasFinished).length + 1
          : undefined;

        return {
          ...p,
          hand: newHand,
          hasFinished,
          finishPosition,
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

    // Check if round ended
    await checkRoundEnd(newPlayers);
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

  // AI-specific functions
  const playHandForAI = async (aiPlayerId: string, cards: CardType[], handType: string) => {
    if (!gameState) return;

    const aiPlayer = gameState.players.find(p => p.id === aiPlayerId);
    if (!aiPlayer) return;

    const newPlayers = gameState.players.map(p => {
      if (p.id === aiPlayerId) {
        const newHand = p.hand.filter(c => !cards.some(pc => pc.id === c.id));
        // Check if player finished
        const hasFinished = newHand.length === 0;
        const finishPosition = hasFinished
          ? gameState.players.filter(pl => pl.hasFinished).length + 1
          : undefined;

        return {
          ...p,
          hand: newHand,
          hasFinished,
          finishPosition,
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
        playerId: aiPlayerId,
        playerName: aiPlayer.name,
      },
      playedCards: newPlayedCards,
      passedPlayerIds: [],
      currentPlayerId: getNextPlayerId(),
    };

    await updateGameState(updatedState);
    setMessage(`${aiPlayer.name} played ${handType}!`);

    // Check if round ended
    await checkRoundEnd(newPlayers);
  };

  const handlePassForAI = async (aiPlayerId: string) => {
    if (!gameState) return;

    const aiPlayer = gameState.players.find(p => p.id === aiPlayerId);
    if (!aiPlayer) return;

    const newPassedIds = [...gameState.passedPlayerIds, aiPlayerId];

    // Check if all other active players have passed
    const activePlayers = gameState.players.filter(p => !p.hasFinished);
    const allOthersPassedOrFinished =
      activePlayers.filter(p => p.id !== gameState.currentHand?.playerId).length ===
      newPassedIds.length;

    if (allOthersPassedOrFinished) {
      await collectCards();
    } else {
      const updatedState: GameState = {
        ...gameState,
        passedPlayerIds: newPassedIds,
        currentPlayerId: getNextPlayerId(),
      };
      await updateGameState(updatedState);
    }

    setMessage(`${aiPlayer.name} passed.`);
  };

  const checkRoundEnd = async (players: Player[]) => {
    const playersWithCards = players.filter(p => p.hand.length > 0);

    if (playersWithCards.length === 1) {
      // Round ended! Last player remaining
      await endRound(players, playersWithCards[0]);
    }
  };

  const endRound = async (players: Player[], lastPlayer: Player) => {
    if (!gameState) return;

    // Get finish positions
    const firstPlace = players.find(p => p.finishPosition === 1);
    const secondPlace = players.find(p => p.finishPosition === 2);

    if (!firstPlace || !secondPlace) {
      console.error('Could not find first or second place!');
      return;
    }

    // Calculate point redistribution
    const lastPlayerHandPoints = lastPlayer.hand.reduce((sum, card) => sum + getCardPoints(card), 0);

    // Update total points
    const updatedPlayers = players.map(p => {
      let pointsToAdd = p.tempPoints; // Keep their collected points

      if (p.id === firstPlace.id) {
        // First place gets last player's temp points
        pointsToAdd += lastPlayer.tempPoints;
      }

      if (p.id === secondPlace.id) {
        // Second place gets last player's hand points
        pointsToAdd += lastPlayerHandPoints;
      }

      if (p.id === lastPlayer.id) {
        // Last player loses everything
        pointsToAdd = 0;
      }

      return {
        ...p,
        totalPoints: p.totalPoints + pointsToAdd,
        tempPoints: 0,
        hasFinished: false,
        finishPosition: undefined,
      };
    });

    // Check if anyone won the game
    const winner = updatedPlayers.find(p => p.totalPoints >= gameState.targetPoints);

    if (winner) {
      // Game over!
      const finalState: GameState = {
        ...gameState,
        players: updatedPlayers,
        gameStatus: 'game-end',
        winnerId: winner.id,
      };
      await updateGameState(finalState);
      setMessage(`🎉 ${winner.name} wins the game with ${winner.totalPoints} points!`);
    } else {
      // Show round-end standings
      const roundEndState: GameState = {
        ...gameState,
        players: updatedPlayers,
        gameStatus: 'round-end',
      };
      await updateGameState(roundEndState);
      setMessage(`Round ${gameState.roundNumber} complete! Check the standings.`);
    }
  };

  const startNextRound = async () => {
    if (!gameState) return;

    const numPlayers = gameState.players.length;
    const numDecks = Math.ceil(numPlayers / 4);
    const deck = createDeck(numDecks);
    const hands = dealCards(deck, numPlayers);

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

    const nextRoundState: GameState = {
      ...gameState,
      players: updatedPlayers,
      currentPlayerId: updatedPlayers[firstPlayerIdx].id,
      currentHand: null,
      playedCards: [],
      passedPlayerIds: [],
      roundNumber: gameState.roundNumber + 1,
      gameStatus: 'playing',
    };

    await updateGameState(nextRoundState);
    setMessage(`Round ${nextRoundState.roundNumber} begins! ${updatedPlayers[firstPlayerIdx].name} has 3♠.`);
  };

  const getNextPlayerId = (): string => {
    if (!gameState) return '';

    const activePlayers = gameState.players.filter(p => !p.hasFinished);
    const currentIdx = activePlayers.findIndex(p => p.id === gameState.currentPlayerId);
    const nextIdx = (currentIdx + 1) % activePlayers.length;

    return activePlayers[nextIdx].id;
  };

  if (!gameState) {
    return <div style={{ padding: '20px' }}>Loading game...</div>;
  }

  const currentPlayer = getCurrentPlayer();
  const theme = getTheme(gameState.theme || 'default');

  return (
    <div style={{
      minHeight: '100vh',
      background: theme.background,
      padding: '20px',
      fontFamily: 'Poppins, sans-serif',
      transition: 'background 0.5s ease',
    }}>
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
      }}>
        <h1 style={{
          color: theme.secondaryColor,
          textShadow: '3px 3px 0 rgba(0, 0, 0, 0.2)',
          marginBottom: '20px',
        }}>WuShiK</h1>

        <div style={{
          marginBottom: '20px',
          padding: '20px',
          backgroundColor: theme.panelBg,
          borderRadius: '16px',
          border: `3px solid ${theme.panelBorder}`,
          boxShadow: '0 4px 0 rgba(0, 0, 0, 0.2)',
        }}>
          <p><strong>Game ID:</strong> {gameId}</p>
          <p><strong>Round:</strong> {gameState.roundNumber} | <strong>Target Points:</strong> {gameState.targetPoints}</p>
          <p><strong>Status:</strong> {gameState.gameStatus}</p>
          <p style={{ color: theme.primaryColor, fontWeight: 600 }}><strong>Message:</strong> {message}</p>
        </div>

      {gameState.gameStatus === 'waiting' && isHost && (
        <div style={{ marginBottom: '20px' }}>
          <button
            onClick={startGame}
            className="pixel-button"
            style={{
              backgroundColor: theme.primaryColor,
              color: gameState.theme === 'space' || gameState.theme === 'neon' ? '#fff' : '#000',
            }}
          >
            Start Game ({gameState.players.length} players joined)
          </button>
        </div>
      )}

      {/* Game Over Screen */}
      {gameState.gameStatus === 'game-end' && (
        <div style={{
          marginBottom: '30px',
          padding: '40px',
          backgroundColor: theme.panelBg,
          borderRadius: '24px',
          border: `6px solid ${theme.primaryColor}`,
          boxShadow: '0 8px 0 rgba(0, 0, 0, 0.3)',
          textAlign: 'center',
        }}>
          <h2 style={{
            fontSize: '48px',
            color: theme.primaryColor,
            marginBottom: '20px',
          }}>🎉 Game Over! 🎉</h2>
          {gameState.winnerId && (
            <p style={{ fontSize: '24px', marginBottom: '30px' }}>
              <strong>{gameState.players.find(p => p.id === gameState.winnerId)?.name}</strong> wins!
            </p>
          )}
          <div style={{
            background: 'rgba(0,0,0,0.05)',
            borderRadius: '12px',
            padding: '20px',
          }}>
            <h3 style={{ marginBottom: '15px' }}>Final Standings</h3>
            {[...gameState.players]
              .sort((a, b) => b.totalPoints - a.totalPoints)
              .map((player, idx) => (
                <div key={player.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '15px',
                  marginBottom: '8px',
                  backgroundColor: idx === 0 ? theme.primaryColor : '#fff',
                  borderRadius: '8px',
                  fontWeight: idx === 0 ? 'bold' : 'normal',
                  fontSize: idx === 0 ? '18px' : '16px',
                }}>
                  <span>#{idx + 1} {player.name}</span>
                  <span>{player.totalPoints} pts</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Round End Standings */}
      {gameState.gameStatus === 'round-end' && (
        <div style={{
          marginBottom: '30px',
          padding: '30px',
          backgroundColor: theme.panelBg,
          borderRadius: '24px',
          border: `6px solid ${theme.secondaryColor}`,
          boxShadow: '0 8px 0 rgba(0, 0, 0, 0.3)',
        }}>
          <h2 style={{
            fontSize: '32px',
            color: theme.secondaryColor,
            marginBottom: '20px',
            textAlign: 'center',
          }}>Round {gameState.roundNumber} Complete!</h2>
          <div style={{
            background: 'rgba(0,0,0,0.05)',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '20px',
          }}>
            <h3 style={{ marginBottom: '15px' }}>Current Standings</h3>
            {[...gameState.players]
              .sort((a, b) => b.totalPoints - a.totalPoints)
              .map((player, idx) => (
                <div key={player.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '12px',
                  marginBottom: '6px',
                  backgroundColor: player.id === playerId ? theme.primaryColor + '40' : '#fff',
                  borderRadius: '8px',
                  border: player.id === playerId ? `2px solid ${theme.primaryColor}` : 'none',
                }}>
                  <span><strong>#{idx + 1}</strong> {player.name} {player.id === playerId && '(You)'}</span>
                  <span><strong>{player.totalPoints}</strong> pts</span>
                </div>
              ))}
          </div>
          {isHost && (
            <button
              onClick={startNextRound}
              className="pixel-button"
              style={{
                width: '100%',
                backgroundColor: theme.secondaryColor,
                color: '#fff',
              }}
            >
              Start Next Round
            </button>
          )}
        </div>
      )}

      {gameState.currentHand && gameState.gameStatus === 'playing' && (
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
    </div>
  );
}
