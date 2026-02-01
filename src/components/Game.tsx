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

interface GameProps {
  gameId: string;
  playerId: string;
  playerName: string;
}

export function Game({ gameId, playerId, playerName }: GameProps) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [message, setMessage] = useState('');

  // Initialize game (in a real app, this would come from Supabase)
  useEffect(() => {
    // For now, we'll use local state
    // TODO: Replace with Supabase real-time subscription
    initializeLocalGame();
  }, []);

  const initializeLocalGame = () => {
    const numPlayers = 4; // Default for testing
    const numDecks = Math.ceil(numPlayers / 4);
    const deck = createDeck(numDecks);
    const hands = dealCards(deck, numPlayers);

    // Find who has 3 of spades
    const firstPlayerIdx = findThreeOfSpades(hands);

    const players: Player[] = hands.map((hand, idx) => ({
      id: `player-${idx}`,
      name: idx === 0 ? playerName : `Player ${idx + 1}`,
      hand: hand.sort((a, b) => {
        // Sort by suit then rank
        if (a.isJoker && b.isJoker) return 0;
        if (a.isJoker) return 1;
        if (b.isJoker) return -1;
        if (a.suit !== b.suit) return a.suit!.localeCompare(b.suit!);
        return a.rank!.localeCompare(b.rank!);
      }),
      tempPoints: 0,
      totalPoints: 0,
      hasFinished: false,
    }));

    setGameState({
      id: gameId,
      players,
      currentPlayerId: players[firstPlayerIdx].id,
      deck: [],
      currentHand: null,
      playedCards: [],
      passedPlayerIds: [],
      roundNumber: 1,
      targetPoints: 100,
      gameStatus: 'playing',
      firstPlayerId: players[firstPlayerIdx].id,
    });

    setMessage(`${players[firstPlayerIdx].name} has 3♠ and starts!`);
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

  const handlePlay = () => {
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
    playHand(cards, handType);
  };

  const playHand = (cards: CardType[], handType: string) => {
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

    setGameState({
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
    });

    setSelectedCards([]);
    setMessage(`You played ${handType}!`);

    // Check if player finished
    const currentPlayer = newPlayers.find(p => p.id === playerId);
    if (currentPlayer && currentPlayer.hand.length === 0) {
      handlePlayerFinished();
    }
  };

  const handlePass = () => {
    if (!gameState || !isMyTurn()) return;

    const newPassedIds = [...gameState.passedPlayerIds, playerId];

    // Check if all other active players have passed
    const activePlayers = gameState.players.filter(p => !p.hasFinished);
    const allOthersPassedOrFinished =
      activePlayers.filter(p => p.id !== gameState.currentHand?.playerId).length ===
      newPassedIds.length;

    if (allOthersPassedOrFinished) {
      // Winner of the trick collects cards
      collectCards();
    } else {
      setGameState({
        ...gameState,
        passedPlayerIds: newPassedIds,
        currentPlayerId: getNextPlayerId(),
      });
    }

    setMessage('You passed.');
  };

  const collectCards = () => {
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

    setGameState({
      ...gameState,
      players: newPlayers,
      currentHand: null,
      playedCards: [],
      passedPlayerIds: [],
      currentPlayerId: winnerId,
    });

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
    // Handle end-of-round scoring
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
        <p><strong>Message:</strong> {message}</p>
      </div>

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

      {currentPlayer && (
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
