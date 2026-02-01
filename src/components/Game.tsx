import { useState, useEffect } from 'react';
import type { Card as CardType, GameState, Player, PlayedHand, PlayLogEntry } from '../types/game';
import { Card, getCardDisplayString, isRedSuit } from './Card';
import {
  createDeck,
  dealCards,
  findThreeOfSpades,
  validateHand,
  canBeatHand,
  getCardPoints,
  sortByRank,
  sortByRecommended,
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
  const [sortedHand, setSortedHand] = useState<CardType[]>([]);
  const [isDraggingOverPlayArea, setIsDraggingOverPlayArea] = useState(false);
  const [playAreaError, setPlayAreaError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [specialEffect, setSpecialEffect] = useState<'wushik' | 'bomb' | 'counter' | null>(null);
  const [showPlayLog, setShowPlayLog] = useState(false); // For mobile toggle
  const [sweepingCards, setSweepingCards] = useState(false);
  const [collectingPoints, setCollectingPoints] = useState<number | null>(null);

  // Get consistent color for each player
  const getPlayerColor = (playerName: string): string => {
    const colors = [
      '#3498db', // blue
      '#e74c3c', // red
      '#2ecc71', // green
      '#f39c12', // orange
      '#9b59b6', // purple
      '#1abc9c', // teal
      '#e67e22', // dark orange
      '#34495e', // dark gray
    ];

    // Simple hash function to get consistent color per player
    let hash = 0;
    for (let i = 0; i < playerName.length; i++) {
      hash = playerName.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  // Load game from Supabase and subscribe to updates
  useEffect(() => {
    loadGame();
    subscribeToGame();

    return () => {
      supabase.channel(`game-${gameId}`).unsubscribe();
    };
  }, [gameId]);

  // Initialize sorted hand only once, preserve manual arrangement
  useEffect(() => {
    const currentPlayer = getCurrentPlayer();
    if (currentPlayer && sortedHand.length === 0) {
      setSortedHand(currentPlayer.hand);
    }
  }, [gameState?.players]);

  // Update sortedHand to remove played cards while preserving order
  useEffect(() => {
    const currentPlayer = getCurrentPlayer();
    if (currentPlayer && sortedHand.length > 0) {
      const currentHandIds = new Set(currentPlayer.hand.map(c => c.id));
      const updatedSortedHand = sortedHand.filter(c => currentHandIds.has(c.id));
      if (updatedSortedHand.length !== sortedHand.length) {
        setSortedHand(updatedSortedHand);
      }
    }
  }, [gameState?.players]);

  // Auto-skip finished players
  useEffect(() => {
    if (!gameState || gameState.gameStatus !== 'playing') return;

    const currentPlayer = gameState.players.find(p => p.id === gameState.currentPlayerId);
    if (!currentPlayer) return;

    // If current player has finished, automatically skip to next player
    if (currentPlayer.hasFinished) {
      const timer = setTimeout(async () => {
        const updatedState: GameState = {
          ...gameState,
          currentPlayerId: getNextPlayerId(),
        };
        await updateGameState(updatedState);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [gameState?.currentPlayerId, gameState?.gameStatus]);

  // Handle AI player turns
  useEffect(() => {
    if (!gameState || gameState.gameStatus !== 'playing') return;

    const currentPlayer = gameState.players.find(p => p.id === gameState.currentPlayerId);
    if (!currentPlayer || !currentPlayer.isAI || currentPlayer.hasFinished) return;

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
    try {
      setLoading(true);
      setLoadError(null);

      const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single();

      if (error) {
        // Game doesn't exist, create it if we're the first player
        if (error.code === 'PGRST116') {
          await createGame();
        } else {
          throw new Error(`Failed to load game: ${error.message}`);
        }
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
    } catch (err) {
      console.error('Error loading game:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to connect to game server');
    } finally {
      setLoading(false);
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
      firstPlaceCount: 0,
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
        firstPlaceCount: 0,
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
      playLog: [],
    };

    const { error } = await supabase
      .from('games')
      .insert({ id: gameId, state: initialState });

    if (error) {
      console.error('Error creating game:', error);
      setLoadError(`Failed to create game: ${error.message}`);
    } else {
      setGameState(initialState);
      setIsHost(true);
      const totalPlayers = initialPlayers.length;
      setMessage(`${totalPlayers} player${totalPlayers > 1 ? 's' : ''} in lobby. Need ${Math.max(0, 3 - totalPlayers)} more to start!`);
    }
    setLoading(false);
  };

  const joinExistingGame = async (state: GameState) => {
    const newPlayer: Player = {
      id: playerId,
      name: playerName,
      hand: [],
      tempPoints: 0,
      totalPoints: 0,
      hasFinished: false,
      firstPlaceCount: 0,
    };

    const updatedState = {
      ...state,
      players: [...state.players, newPlayer],
    };

    await updateGameState(updatedState);
    setMessage(`${playerName} joined the game!`);
  };

  const addBot = async () => {
    if (!gameState) return;

    const botCount = gameState.players.filter(p => p.isAI).length;
    const newBot: Player = {
      id: `ai-${Date.now()}`,
      name: `Bot ${botCount + 1}`,
      hand: [],
      tempPoints: 0,
      totalPoints: 0,
      hasFinished: false,
      isAI: true,
      firstPlaceCount: 0,
    };

    const updatedState = {
      ...gameState,
      players: [...gameState.players, newBot],
    };

    await updateGameState(updatedState);
    setMessage(`Bot ${botCount + 1} joined the game!`);
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

  // Validate selected cards and return error message if invalid
  const getPlayError = (): string | null => {
    if (!isMyTurn()) return "Not your turn";
    if (selectedCards.length === 0) return "Select cards to play";

    const currentPlayer = getCurrentPlayer();
    if (!currentPlayer) return "Player not found";

    const cards = selectedCards.map(id => currentPlayer.hand.find(c => c.id === id)!);
    const handType = validateHand(cards);

    if (!handType) return "Invalid hand combination";

    // Check if can beat current hand
    if (gameState?.currentHand) {
      const newHand: PlayedHand = {
        cards,
        type: handType,
        playerId,
        playerName,
      };

      if (!canBeatHand(newHand, gameState.currentHand)) {
        return "Cannot beat current hand";
      }
    }

    return null;
  };

  // Sorting functions
  const handleSortByRank = () => {
    const currentPlayer = getCurrentPlayer();
    if (currentPlayer) {
      setSortedHand(sortByRank(currentPlayer.hand));
    }
  };

  const handleSortByRecommended = () => {
    const currentPlayer = getCurrentPlayer();
    if (currentPlayer) {
      setSortedHand(sortByRecommended(currentPlayer.hand));
    }
  };

  // Drag and drop handlers
  const handleDragStart = (cardId: string) => (e: React.DragEvent) => {
    // If dragging a selected card, drag all selected cards
    if (selectedCards.includes(cardId)) {
      e.dataTransfer.setData('cardIds', JSON.stringify(selectedCards));
    } else {
      e.dataTransfer.setData('cardIds', JSON.stringify([cardId]));
    }
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (targetCardId: string) => (e: React.DragEvent) => {
    e.preventDefault();
    const cardIdsData = e.dataTransfer.getData('cardIds');
    if (!cardIdsData) return;

    const draggedCardIds: string[] = JSON.parse(cardIdsData);
    if (draggedCardIds.length === 0 || draggedCardIds.includes(targetCardId)) return;

    // Get all dragged cards
    const draggedCards = draggedCardIds.map(id => sortedHand.find(c => c.id === id)).filter(Boolean) as CardType[];
    const otherCards = sortedHand.filter(c => !draggedCardIds.includes(c.id));

    const targetIndex = otherCards.findIndex(c => c.id === targetCardId);
    if (targetIndex === -1) return;

    // Insert dragged cards at target position
    const newHand = [...otherCards];
    newHand.splice(targetIndex, 0, ...draggedCards);

    setSortedHand(newHand);
  };

  // Play area drag handlers
  const handlePlayAreaDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDraggingOverPlayArea(true);
    setPlayAreaError(null);
  };

  const handlePlayAreaDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOverPlayArea(false);
    setPlayAreaError(null);
  };

  const handlePlayAreaDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOverPlayArea(false);

    if (!isMyTurn()) {
      setPlayAreaError("Not your turn!");
      setTimeout(() => setPlayAreaError(null), 2000);
      return;
    }

    const cardIdsData = e.dataTransfer.getData('cardIds');
    if (!cardIdsData) return;

    const draggedCardIds: string[] = JSON.parse(cardIdsData);
    const currentPlayer = getCurrentPlayer();
    if (!currentPlayer) return;

    const cards = draggedCardIds.map(id => currentPlayer.hand.find(c => c.id === id)!).filter(Boolean);
    const handType = validateHand(cards);

    if (!handType) {
      setPlayAreaError('Invalid hand!');
      setErrorMessage('❌ Invalid hand combination!');
      setTimeout(() => {
        setPlayAreaError(null);
        setErrorMessage(null);
      }, 2500);
      return;
    }

    // Check if can beat current hand
    if (gameState?.currentHand) {
      const newHand: PlayedHand = {
        cards,
        type: handType,
        playerId,
        playerName,
      };

      if (!canBeatHand(newHand, gameState.currentHand)) {
        setPlayAreaError('Cannot beat current hand!');
        setErrorMessage('❌ Your hand cannot beat the current hand!');
        setTimeout(() => {
          setPlayAreaError(null);
          setErrorMessage(null);
        }, 2500);
        return;
      }
    }

    // Play the hand
    await playHand(cards, handType);
    setSelectedCards([]);
  };

  const handlePlay = async () => {
    if (!gameState || !isMyTurn()) return;

    const currentPlayer = getCurrentPlayer();
    if (!currentPlayer) return;

    const cards = selectedCards.map(id => currentPlayer.hand.find(c => c.id === id)!);
    const handType = validateHand(cards);

    if (!handType) {
      setMessage('Invalid hand! Please select valid cards.');
      setErrorMessage('❌ Invalid hand combination!');
      setTimeout(() => setErrorMessage(null), 2500);
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
        setErrorMessage('❌ Your hand cannot beat the current hand!');
        setTimeout(() => setErrorMessage(null), 2500);
        return;
      }
    }

    // Play the hand
    await playHand(cards, handType);
  };

  const playHand = async (cards: CardType[], handType: string) => {
    if (!gameState) return;

    // Check for special effects
    if (handType === 'wushik' || handType === 'bomb') {
      if (gameState.currentHand && (gameState.currentHand.type === 'wushik' || gameState.currentHand.type === 'bomb')) {
        setSpecialEffect('counter');
        setTimeout(() => setSpecialEffect(null), 2000);
      } else {
        setSpecialEffect(handType as 'wushik' | 'bomb');
        setTimeout(() => setSpecialEffect(null), 1500);
      }
    }

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

    const newLogEntry: PlayLogEntry = {
      playerName,
      action: 'Played',
      cards: cards,
      time: Date.now(),
    };

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
      playLog: [...(gameState.playLog || []), newLogEntry],
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

    const newLogEntry: PlayLogEntry = {
      playerName,
      action: 'Passed',
      time: Date.now(),
    };

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
        playLog: [...(gameState.playLog || []), newLogEntry],
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

    // Start sweep animation
    setSweepingCards(true);

    // After sweep, show point collection
    setTimeout(() => {
      setSweepingCards(false);
      if (points > 0) {
        setCollectingPoints(points);
        setTimeout(() => setCollectingPoints(null), 1500);
      }
    }, 800);

    // Update state after animations
    setTimeout(async () => {
      const newPlayers = gameState.players.map(p => {
        if (p.id === winnerId) {
          return { ...p, tempPoints: p.tempPoints + points };
        }
        return p;
      });

      const newLogEntry: PlayLogEntry = {
        playerName: gameState.currentHand!.playerName,
        action: `Won hand! +${points} pt${points !== 1 ? 's' : ''}`,
        time: Date.now(),
      };

      const updatedState: GameState = {
        ...gameState,
        players: newPlayers,
        currentHand: null,
        playedCards: [],
        passedPlayerIds: [],
        currentPlayerId: winnerId,
        playLog: [...(gameState.playLog || []), newLogEntry],
      };

      await updateGameState(updatedState);
      setMessage(`${gameState.currentHand!.playerName} won the hand and collected ${points} points!`);
    }, 1000);
  };

  // AI-specific functions
  const playHandForAI = async (aiPlayerId: string, cards: CardType[], handType: string) => {
    if (!gameState) return;

    const aiPlayer = gameState.players.find(p => p.id === aiPlayerId);
    if (!aiPlayer) return;

    // Check for special effects
    if (handType === 'wushik' || handType === 'bomb') {
      if (gameState.currentHand && (gameState.currentHand.type === 'wushik' || gameState.currentHand.type === 'bomb')) {
        setSpecialEffect('counter');
        setTimeout(() => setSpecialEffect(null), 2000);
      } else {
        setSpecialEffect(handType as 'wushik' | 'bomb');
        setTimeout(() => setSpecialEffect(null), 1500);
      }
    }

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

    const newLogEntry: PlayLogEntry = {
      playerName: aiPlayer.name,
      action: 'Played',
      cards: cards,
      time: Date.now(),
    };

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
      playLog: [...(gameState.playLog || []), newLogEntry],
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

    const newLogEntry: PlayLogEntry = {
      playerName: aiPlayer.name,
      action: 'Passed',
      time: Date.now(),
    };

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
        playLog: [...(gameState.playLog || []), newLogEntry],
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

    // Show reveal screen first (before calculating points)
    const revealState: GameState = {
      ...gameState,
      players,
      gameStatus: 'round-reveal',
      lastPlayerId: lastPlayer.id,
    };
    await updateGameState(revealState);
    setMessage(`Round ${gameState.roundNumber} complete!`);
  };

  const continueFromReveal = async () => {
    if (!gameState || gameState.gameStatus !== 'round-reveal') return;

    const players = gameState.players;
    const lastPlayer = players.find(p => p.id === gameState.lastPlayerId);
    const firstPlace = players.find(p => p.finishPosition === 1);
    const secondPlace = players.find(p => p.finishPosition === 2);

    if (!lastPlayer || !firstPlace || !secondPlace) return;

    // Calculate point redistribution
    const lastPlayerHandPoints = lastPlayer.hand.reduce((sum, card) => sum + getCardPoints(card), 0);

    // Update total points and first place count
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
        firstPlaceCount: p.id === firstPlace.id ? (p.firstPlaceCount || 0) + 1 : (p.firstPlaceCount || 0),
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

  if (loadError) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: '#fff',
        fontFamily: 'Poppins, sans-serif',
        padding: '20px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>⚠️</div>
        <h2 style={{ marginBottom: '10px' }}>Connection Error</h2>
        <p style={{ marginBottom: '20px', maxWidth: '500px' }}>{loadError}</p>
        <p style={{ fontSize: '12px', opacity: 0.8 }}>
          Check that environment variables are set correctly in Vercel.
        </p>
      </div>
    );
  }

  if (loading || !gameState) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: '#fff',
        fontFamily: 'Poppins, sans-serif',
      }}>
        <div style={{
          fontSize: '48px',
          marginBottom: '20px',
          animation: 'pulse 1.5s ease-in-out infinite',
        }}>
          🎴
        </div>
        <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
          Connecting to game...
        </div>
      </div>
    );
  }

  const currentPlayer = getCurrentPlayer();
  const theme = getTheme(gameState.theme || 'default');

  const isMyTurnNow = isMyTurn();
  const canStartNewHand = isMyTurnNow && !gameState?.currentHand && gameState?.gameStatus === 'playing';

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: theme.background,
      fontFamily: 'Poppins, sans-serif',
      transition: 'background 0.5s ease',
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* Play Log Toggle Button (Mobile Only) */}
      {gameState.gameStatus === 'playing' && (
        <button
          onClick={() => setShowPlayLog(!showPlayLog)}
          className="play-log-toggle"
          style={{
            position: 'fixed',
            top: '80px',
            left: '10px',
            zIndex: 100,
            padding: '10px 16px',
            backgroundColor: theme.primaryColor,
            color: gameState.theme === 'space' || gameState.theme === 'neon' ? '#fff' : '#000',
            border: 'none',
            borderRadius: '8px',
            fontWeight: 'bold',
            fontSize: '14px',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          }}
        >
          {showPlayLog ? '✕ Close Log' : '📋 Play Log'}
        </button>
      )}

      {/* Main Grid Container */}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: gameState.gameStatus === 'playing' ? '200px 1fr' : '1fr',
        gridTemplateRows: 'auto 1fr auto',
        gap: '10px',
        padding: '10px',
        maxWidth: '1800px',
        margin: '0 auto',
        width: '100%',
        overflow: 'hidden',
      }}
      className="main-grid">
        {/* Top Header - spans all columns */}
        <div style={{
          gridColumn: gameState.gameStatus === 'playing' ? '1 / -1' : '1',
          padding: '16px 24px',
          background: `linear-gradient(135deg, ${theme.primaryColor}15 0%, ${theme.secondaryColor}15 100%)`,
          borderRadius: '16px',
          border: `3px solid ${theme.primaryColor}40`,
          boxShadow: `0 4px 12px ${theme.primaryColor}20`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          backdropFilter: 'blur(10px)',
        }}>
          <h1 style={{
            background: `linear-gradient(135deg, ${theme.primaryColor}, ${theme.secondaryColor})`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            textShadow: 'none',
            margin: 0,
            fontSize: '32px',
            fontWeight: 'bold',
            letterSpacing: '2px',
          }}>WuShiK</h1>
          <div style={{
            display: 'flex',
            gap: '24px',
            fontSize: '14px',
            flexWrap: 'wrap',
            alignItems: 'center',
          }}>
            <span style={{
              padding: '6px 14px',
              backgroundColor: theme.panelBg,
              borderRadius: '8px',
              border: `2px solid ${theme.panelBorder}`,
              fontWeight: 'bold',
            }}>
              🎮 {gameId}
            </span>
            <span style={{
              padding: '6px 14px',
              backgroundColor: theme.primaryColor,
              color: gameState.theme === 'space' || gameState.theme === 'neon' ? '#fff' : '#000',
              borderRadius: '8px',
              fontWeight: 'bold',
            }}>
              Round {gameState.roundNumber}
            </span>
            <span style={{
              padding: '6px 14px',
              backgroundColor: theme.secondaryColor,
              color: '#fff',
              borderRadius: '8px',
              fontWeight: 'bold',
            }}>
              🎯 {gameState.targetPoints}pts
            </span>
          </div>
          {message && (
            <div style={{
              flex: '1 1 100%',
              color: theme.secondaryColor,
              fontWeight: 600,
              fontSize: '14px',
              marginTop: '4px',
              padding: '8px 12px',
              backgroundColor: `${theme.secondaryColor}15`,
              borderRadius: '8px',
              borderLeft: `4px solid ${theme.secondaryColor}`,
            }}>
              {message}
            </div>
          )}
        </div>

        {/* Left Sidebar - Play Log (only during playing) */}
        {gameState.gameStatus === 'playing' && (
          <div
            className={`play-log-sidebar ${showPlayLog ? 'show' : ''}`}
            style={{
            gridRow: '2',
            backgroundColor: theme.panelBg,
            borderRadius: '12px',
            border: `2px solid ${theme.panelBorder}`,
            padding: '12px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
          }}>
            <h3 style={{
              fontSize: '14px',
              color: theme.secondaryColor,
              margin: '0 0 10px 0',
              textAlign: 'center',
              borderBottom: `2px solid ${theme.panelBorder}`,
              paddingBottom: '8px',
            }}>Play Log</h3>
            <div style={{
              display: 'flex',
              flexDirection: 'column-reverse',
              gap: '8px',
              fontSize: '11px',
            }}>
              {(gameState.playLog || []).slice(-20).map((log, idx) => {
                const playerColor = getPlayerColor(log.playerName);
                return (
                  <div key={`${log.time}-${idx}`} style={{
                    padding: '8px',
                    backgroundColor: 'rgba(0,0,0,0.03)',
                    borderRadius: '8px',
                    borderLeft: `4px solid ${playerColor}`,
                  }}>
                    <div style={{ fontWeight: 'bold', color: playerColor, marginBottom: '4px' }}>
                      {log.playerName}
                    </div>
                    <div style={{ color: '#666', fontSize: '10px', marginBottom: '4px' }}>
                      {log.action}
                    </div>
                    {log.cards && log.cards.length > 0 && (
                      <div style={{
                        display: 'flex',
                        gap: '4px',
                        flexWrap: 'wrap',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        color: '#333',
                      }}>
                        {log.cards.map((card, cardIdx) => (
                          <span key={cardIdx} style={{
                            padding: '2px 6px',
                            backgroundColor: '#fff',
                            borderRadius: '4px',
                            border: '1px solid #ddd',
                            color: isRedSuit(card) ? '#e74c3c' : '#000',
                            fontWeight: 'bold',
                          }}>
                            {getCardDisplayString(card)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {(gameState.playLog || []).length === 0 && (
                <div style={{ textAlign: 'center', color: '#999', padding: '20px 0' }}>
                  No plays yet
                </div>
              )}
            </div>
          </div>
        )}

        {/* Main Center Area */}
        <div style={{
          gridRow: '2',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          overflow: 'hidden',
        }}>
          {/* Waiting State */}
          {gameState.gameStatus === 'waiting' && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              gap: '20px',
            }}>
              <div style={{
                padding: '40px',
                backgroundColor: theme.panelBg,
                borderRadius: '24px',
                border: `4px solid ${theme.panelBorder}`,
                textAlign: 'center',
              }}>
                <h2 style={{ color: theme.secondaryColor, marginBottom: '20px' }}>
                  Waiting for players...
                </h2>
                <div style={{ marginBottom: '20px' }}>
                  <h3 style={{ marginBottom: '15px' }}>Players ({gameState.players.length}):</h3>
                  {gameState.players.map(player => (
                    <div key={player.id} style={{
                      padding: '10px',
                      marginBottom: '8px',
                      backgroundColor: player.id === playerId ? `${theme.primaryColor}20` : '#fff',
                      borderRadius: '8px',
                      border: player.id === playerId ? `2px solid ${theme.primaryColor}` : 'none',
                    }}>
                      {player.name} {player.id === playerId && '(You)'}
                    </div>
                  ))}
                </div>
                {isHost && (
                  <div style={{ display: 'flex', gap: '12px', flexDirection: 'column' }}>
                    <button
                      onClick={addBot}
                      className="pixel-button"
                      style={{
                        backgroundColor: theme.secondaryColor,
                        color: '#fff',
                        padding: '12px 24px',
                        fontSize: '14px',
                      }}
                    >
                      🤖 Add Bot
                    </button>
                    <button
                      onClick={startGame}
                      className="pixel-button"
                      disabled={gameState.players.length < 3}
                      style={{
                        backgroundColor: gameState.players.length >= 3 ? theme.primaryColor : '#95a5a6',
                        color: gameState.theme === 'space' || gameState.theme === 'neon' ? '#fff' : '#000',
                        opacity: gameState.players.length < 3 ? 0.5 : 1,
                        padding: '16px 32px',
                        fontSize: '16px',
                      }}
                    >
                      {gameState.players.length >= 3
                        ? `Start Game (${gameState.players.length} players)`
                        : `Need ${3 - gameState.players.length} more player${3 - gameState.players.length > 1 ? 's' : ''}`
                      }
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Round Reveal - Show last place details */}
          {gameState.gameStatus === 'round-reveal' && (() => {
            const lastPlayer = gameState.players.find(p => p.id === gameState.lastPlayerId);
            const firstPlace = gameState.players.find(p => p.finishPosition === 1);
            const secondPlace = gameState.players.find(p => p.finishPosition === 2);
            if (!lastPlayer || !firstPlace || !secondPlace) return null;

            const lastPlayerHandPoints = lastPlayer.hand.reduce((sum, card) => sum + getCardPoints(card), 0);

            return (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 1,
                gap: '20px',
                padding: '20px',
              }}>
                <div style={{
                  padding: '24px',
                  backgroundColor: theme.panelBg,
                  borderRadius: '20px',
                  border: `4px solid ${theme.secondaryColor}`,
                  boxShadow: '0 8px 0 rgba(0, 0, 0, 0.3)',
                  maxWidth: '1200px',
                  width: '100%',
                }}>
                  <h2 style={{
                    fontSize: '28px',
                    color: theme.secondaryColor,
                    marginBottom: '24px',
                    textAlign: 'center',
                  }}>Round {gameState.roundNumber} Complete!</h2>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 2fr',
                    gap: '20px',
                    marginBottom: '20px',
                  }}>
                    {/* Left: Last Place */}
                    <div style={{
                      background: 'rgba(231, 76, 60, 0.1)',
                      borderRadius: '12px',
                      padding: '16px',
                      border: '3px solid #e74c3c',
                    }}>
                      <h3 style={{ marginBottom: '12px', color: '#e74c3c', fontSize: '18px' }}>
                        😰 Last Place
                      </h3>
                      <div style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '12px' }}>
                        {lastPlayer.name}
                      </div>
                      <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                        Temp: {lastPlayer.tempPoints} pts | Hand: {lastPlayerHandPoints} pts
                      </div>
                      <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '12px' }}>
                        {lastPlayer.hand.length} cards left
                      </div>
                      <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '3px',
                        justifyContent: 'center',
                        padding: '8px',
                        backgroundColor: 'rgba(0,0,0,0.05)',
                        borderRadius: '6px',
                        maxHeight: '120px',
                        overflowY: 'auto',
                      }}>
                        {lastPlayer.hand.map(card => (
                          <Card key={card.id} card={card} small />
                        ))}
                      </div>
                    </div>

                    {/* Right: Point Allocation */}
                    <div style={{
                      background: 'rgba(46, 204, 113, 0.1)',
                      borderRadius: '12px',
                      padding: '16px',
                      border: '3px solid #2ecc71',
                    }}>
                      <h3 style={{ marginBottom: '16px', color: '#2ecc71', fontSize: '18px' }}>
                        📊 Point Distribution
                      </h3>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <div style={{
                          flex: 1,
                          padding: '12px',
                          backgroundColor: 'rgba(255, 215, 0, 0.2)',
                          borderRadius: '8px',
                          border: '2px solid gold',
                        }}>
                          <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>
                            🥇 {firstPlace.name}
                          </div>
                          <div style={{ fontSize: '13px' }}>
                            Keeps: {firstPlace.tempPoints} pts
                            <br />
                            +Last temp: {lastPlayer.tempPoints} pts
                          </div>
                          <div style={{ marginTop: '8px', fontSize: '16px', fontWeight: 'bold', color: theme.primaryColor }}>
                            → {firstPlace.tempPoints + lastPlayer.tempPoints} pts
                          </div>
                        </div>

                        <div style={{
                          flex: 1,
                          padding: '12px',
                          backgroundColor: 'rgba(192, 192, 192, 0.2)',
                          borderRadius: '8px',
                          border: '2px solid silver',
                        }}>
                          <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>
                            🥈 {secondPlace.name}
                          </div>
                          <div style={{ fontSize: '13px' }}>
                            Keeps: {secondPlace.tempPoints} pts
                            <br />
                            +Last hand: {lastPlayerHandPoints} pts
                          </div>
                          <div style={{ marginTop: '8px', fontSize: '16px', fontWeight: 'bold', color: theme.primaryColor }}>
                            → {secondPlace.tempPoints + lastPlayerHandPoints} pts
                          </div>
                        </div>

                        <div style={{
                          flex: 1,
                          padding: '12px',
                          backgroundColor: 'rgba(231, 76, 60, 0.1)',
                          borderRadius: '8px',
                          border: '2px solid #e74c3c',
                        }}>
                          <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>
                            📉 {lastPlayer.name}
                          </div>
                          <div style={{ fontSize: '13px', color: '#e74c3c' }}>
                            Loses everything
                          </div>
                          <div style={{ marginTop: '8px', fontSize: '16px', fontWeight: 'bold', color: '#e74c3c' }}>
                            → 0 pts
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={continueFromReveal}
                    className="pixel-button"
                    style={{
                      width: '100%',
                      backgroundColor: theme.secondaryColor,
                      color: '#fff',
                      fontSize: '18px',
                      padding: '16px',
                    }}
                  >
                    Continue to Standings →
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Game Over Screen */}
          {gameState.gameStatus === 'game-end' && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
            }}>
              <div style={{
                padding: '40px',
                backgroundColor: theme.panelBg,
                borderRadius: '24px',
                border: `6px solid ${theme.primaryColor}`,
                boxShadow: '0 8px 0 rgba(0, 0, 0, 0.3)',
                textAlign: 'center',
                maxWidth: '600px',
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
                        alignItems: 'center',
                        padding: '15px',
                        marginBottom: '8px',
                        backgroundColor: idx === 0 ? theme.primaryColor : '#fff',
                        borderRadius: '8px',
                        fontWeight: idx === 0 ? 'bold' : 'normal',
                        fontSize: idx === 0 ? '18px' : '16px',
                      }}>
                        <span>#{idx + 1} {player.name}</span>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                          {(player.firstPlaceCount || 0) > 0 && (
                            <span style={{ fontSize: '14px', opacity: 0.8 }}>
                              🥇×{player.firstPlaceCount}
                            </span>
                          )}
                          <span>{player.totalPoints} pts</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* Round End Standings */}
          {gameState.gameStatus === 'round-end' && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
            }}>
              <div style={{
                padding: '30px',
                backgroundColor: theme.panelBg,
                borderRadius: '24px',
                border: `6px solid ${theme.secondaryColor}`,
                boxShadow: '0 8px 0 rgba(0, 0, 0, 0.3)',
                maxWidth: '600px',
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
                        alignItems: 'center',
                        padding: '12px',
                        marginBottom: '6px',
                        backgroundColor: player.id === playerId ? theme.primaryColor + '40' : '#fff',
                        borderRadius: '8px',
                        border: player.id === playerId ? `2px solid ${theme.primaryColor}` : 'none',
                      }}>
                        <span><strong>#{idx + 1}</strong> {player.name} {player.id === playerId && '(You)'}</span>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          {(player.firstPlaceCount || 0) > 0 && (
                            <span style={{ fontSize: '12px', opacity: 0.8 }}>
                              🥇×{player.firstPlaceCount}
                            </span>
                          )}
                          <span><strong>{player.totalPoints}</strong> pts</span>
                        </div>
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
            </div>
          )}

          {/* Playing State - Table View */}
          {gameState.gameStatus === 'playing' && (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              minHeight: 0,
            }}>
              {/* Players positioned around play area */}
              <div
                className="play-area-container"
                style={{
                position: 'relative',
                flex: 1,
                minHeight: '400px',
              }}>
                {/* Error Message Overlay */}
                {errorMessage && (
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    zIndex: 1000,
                    backgroundColor: '#e74c3c',
                    color: '#fff',
                    padding: '24px 40px',
                    borderRadius: '16px',
                    fontSize: '20px',
                    fontWeight: 'bold',
                    boxShadow: '0 8px 32px rgba(231, 76, 60, 0.5)',
                    animation: 'shake 0.5s, fadeIn 0.3s',
                    textAlign: 'center',
                    border: '4px solid #c0392b',
                  }}>
                    {errorMessage}
                  </div>
                )}

                {/* Special Effect Overlay */}
                {specialEffect && (
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    zIndex: 999,
                    pointerEvents: 'none',
                  }}>
                    {specialEffect === 'counter' ? (
                      <div style={{
                        fontSize: '120px',
                        fontWeight: 'bold',
                        animation: 'explode 2s ease-out',
                        background: 'linear-gradient(45deg, #ff0000, #ff7700, #ffdd00, #00ff00, #0099ff, #9900ff)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                        textShadow: '0 0 30px rgba(255, 255, 255, 0.8)',
                        filter: 'drop-shadow(0 0 20px rgba(255, 255, 255, 0.6))',
                      }}>
                        💥 COUNTER! 💥
                      </div>
                    ) : specialEffect === 'bomb' ? (
                      <div style={{
                        fontSize: '100px',
                        fontWeight: 'bold',
                        animation: 'bombPulse 1.5s ease-out',
                        color: '#ff4444',
                        textShadow: '0 0 20px rgba(255, 68, 68, 0.8), 0 0 40px rgba(255, 68, 68, 0.6)',
                        filter: 'drop-shadow(0 0 15px rgba(255, 68, 68, 0.8))',
                      }}>
                        💣 BOMB!
                      </div>
                    ) : (
                      <div style={{
                        fontSize: '100px',
                        fontWeight: 'bold',
                        animation: 'wushikShine 1.5s ease-out',
                        background: 'linear-gradient(135deg, gold, #ffd700, #ffed4e)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                        textShadow: '0 0 20px rgba(255, 215, 0, 0.8)',
                        filter: 'drop-shadow(0 0 15px rgba(255, 215, 0, 0.6))',
                      }}>
                        ✨ WUSHIK! ✨
                      </div>
                    )}
                  </div>
                )}

                {/* Central Play Area */}
                <div
                  onDragOver={handlePlayAreaDragOver}
                  onDragLeave={handlePlayAreaDragLeave}
                  onDrop={handlePlayAreaDrop}
                  style={{
                    position: 'absolute',
                    top: '45%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '70%',
                    minWidth: '500px',
                    maxWidth: '800px',
                    minHeight: '220px',
                    padding: '30px',
                    backgroundColor: isDraggingOverPlayArea
                      ? playAreaError
                        ? 'rgba(231, 76, 60, 0.15)'
                        : 'rgba(46, 204, 113, 0.15)'
                      : 'rgba(255, 255, 255, 0.95)',
                    borderRadius: '20px',
                    border: isDraggingOverPlayArea
                      ? playAreaError
                        ? '4px dashed #e74c3c'
                        : '4px dashed #2ecc71'
                      : `3px solid ${theme.panelBorder}`,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    transition: 'background-color 0.2s ease, border 0.2s ease',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  }}
                >
                  {playAreaError && (
                    <div style={{
                      position: 'absolute',
                      top: '10px',
                      right: '10px',
                      backgroundColor: '#e74c3c',
                      color: '#fff',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      animation: 'shake 0.5s',
                    }}>
                      {playAreaError}
                    </div>
                  )}

                  {canStartNewHand && (
                    <div style={{
                      position: 'absolute',
                      top: '20px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      backgroundColor: theme.primaryColor,
                      color: '#fff',
                      padding: '12px 24px',
                      borderRadius: '12px',
                      fontSize: '16px',
                      fontWeight: 'bold',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                      animation: 'pulse 1.5s ease-in-out infinite',
                    }}>
                      🎴 Start New Hand! 🎴
                    </div>
                  )}

                  {collectingPoints !== null && (
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      fontSize: '48px',
                      fontWeight: 'bold',
                      color: theme.secondaryColor,
                      animation: 'collectPoints 1.5s ease-out',
                      zIndex: 100,
                      pointerEvents: 'none',
                    }}>
                      +{collectingPoints} pts! 💰
                    </div>
                  )}

                  {gameState.currentHand ? (
                    <>
                      <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', color: '#666', fontWeight: 'bold' }}>
                        {gameState.currentHand.type.toUpperCase()}
                      </h3>
                      <div style={{
                        display: 'flex',
                        gap: '8px',
                        marginBottom: '16px',
                        flexWrap: 'wrap',
                        justifyContent: 'center',
                        animation: sweepingCards ? 'sweepOff 0.8s ease-in forwards' : 'none',
                      }}>
                        {gameState.currentHand.cards.map(card => (
                          <Card key={card.id} card={card} />
                        ))}
                      </div>
                      <p style={{ margin: 0, fontSize: '16px', color: '#666' }}>
                        Played by: <strong style={{ fontSize: '18px', color: theme.primaryColor }}>{gameState.currentHand.playerName}</strong>
                      </p>
                    </>
                  ) : (
                    <div style={{
                      textAlign: 'center',
                      color: isDraggingOverPlayArea ? '#2ecc71' : '#95a5a6',
                      fontSize: '18px',
                    }}>
                      <div style={{ fontSize: '64px', marginBottom: '16px' }}>
                        {isDraggingOverPlayArea ? '✓' : '🎴'}
                      </div>
                      <div style={{ fontWeight: 600, fontSize: '20px' }}>
                        {isDraggingOverPlayArea ? 'Drop cards to play!' : 'Drag cards here to play'}
                      </div>
                    </div>
                  )}
                </div>

                {/* Minimal text-based player list for mobile, positioned boxes for desktop */}
                <div className="players-container-mobile">
                  {gameState.players.map((player, index) => {
                    const cardCount = player.hand.length;
                    const isCurrentTurn = player.id === gameState.currentPlayerId;
                    const isYou = player.id === playerId;

                    return (
                      <span key={player.id}>
                        {index > 0 && <span className="player-separator"> • </span>}
                        <span
                          className="player-text-item"
                          style={{
                            fontWeight: isCurrentTurn ? 'bold' : 'normal',
                            color: isCurrentTurn ? theme.primaryColor : '#333',
                          }}
                        >
                          {isCurrentTurn && '👉 '}
                          {player.name}
                          {isYou && ' (You)'}
                          {cardCount < 5 ? ` (${cardCount})` : ' 🎴'}
                        </span>
                      </span>
                    );
                  })}
                </div>

                {/* Desktop player profiles - positioned around play area */}
                <div className="players-container-desktop">
                {gameState.players.filter(p => p.id !== playerId).map((player) => {
                  const cardCount = player.hand.length;
                  const showCount = cardCount <= 5;
                  const totalPlayers = gameState.players.length;
                  const otherPlayers = gameState.players.filter(p => p.id !== playerId);

                  // Calculate position around the play area
                  const relativeIndex = otherPlayers.findIndex(p => p.id === player.id);

                  let top = '50%';
                  let left = '50%';
                  let transform = 'translate(-50%, -50%)';

                  // Position other players (excluding current player) - desktop positioning
                  if (totalPlayers === 3) {
                    // 2 other players - positioned at top corners
                    if (relativeIndex === 0) {
                      top = '8%'; left = '12%'; transform = 'translate(0, 0)';
                    } else {
                      top = '8%'; left = '88%'; transform = 'translate(-100%, 0)';
                    }
                  } else if (totalPlayers === 4) {
                    // 3 other players - top center and sides
                    if (relativeIndex === 0) {
                      top = '5%'; left = '50%'; transform = 'translate(-50%, 0)';
                    } else if (relativeIndex === 1) {
                      top = '35%'; left = '3%'; transform = 'translate(0, -50%)';
                    } else {
                      top = '35%'; left = '97%'; transform = 'translate(-100%, -50%)';
                    }
                  } else if (totalPlayers === 5) {
                    // 4 other players
                    const positions = [
                      { top: '5%', left: '50%', transform: 'translate(-50%, 0)' },
                      { top: '30%', left: '3%', transform: 'translate(0, 0)' },
                      { top: '30%', left: '97%', transform: 'translate(-100%, 0)' },
                      { top: '5%', left: '18%', transform: 'translate(0, 0)' },
                    ];
                    ({ top, left, transform } = positions[relativeIndex] || positions[0]);
                  } else {
                    // 6+ players: circle around top half
                    const angle = (relativeIndex * Math.PI) / (otherPlayers.length - 1) - Math.PI;
                    const radiusX = 47;
                    const radiusY = 38;
                    left = `${50 + radiusX * Math.cos(angle)}%`;
                    top = `${28 + radiusY * Math.sin(angle)}%`;
                    transform = 'translate(-50%, -50%)';
                  }

                  return (
                    <div
                      key={player.id}
                      className="player-profile"
                      style={{
                        position: 'absolute',
                        top,
                        left,
                        transform,
                        padding: '10px 14px',
                        backgroundColor: player.id === gameState.currentPlayerId
                          ? `${theme.primaryColor}20`
                          : theme.panelBg,
                        borderRadius: '12px',
                        border: player.id === gameState.currentPlayerId
                          ? `2px solid ${theme.primaryColor}`
                          : `2px solid ${theme.panelBorder}`,
                        boxShadow: player.id === gameState.currentPlayerId
                          ? `0 0 0 3px ${theme.primaryColor}40`
                          : '0 2px 6px rgba(0,0,0,0.1)',
                        minWidth: '130px',
                        maxWidth: '180px',
                        transition: 'all 0.3s ease',
                        zIndex: 5,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: '13px' }}>{player.name}</strong>
                        {player.id === playerId && (
                          <span style={{
                            fontSize: '8px',
                            padding: '2px 5px',
                            backgroundColor: theme.primaryColor,
                            color: gameState.theme === 'space' || gameState.theme === 'neon' ? '#fff' : '#000',
                            borderRadius: '6px',
                            fontWeight: 'bold',
                          }}>YOU</span>
                        )}
                        {player.isAI && (
                          <span style={{
                            fontSize: '8px',
                            padding: '2px 5px',
                            backgroundColor: '#95a5a6',
                            color: '#fff',
                            borderRadius: '6px',
                          }}>BOT</span>
                        )}
                        {player.id === gameState.currentPlayerId && (
                          <span style={{ fontSize: '13px' }}>👈</span>
                        )}
                      </div>
                      <div style={{ fontSize: '11px', color: '#666', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span>
                          {showCount ? (
                            <><strong>{cardCount}</strong> card{cardCount !== 1 ? 's' : ''}</>
                          ) : (
                            <span style={{ fontSize: '18px' }}>🃏</span>
                          )}
                        </span>
                        {player.tempPoints > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ fontSize: '10px', fontWeight: 'bold', color: theme.primaryColor }}>
                              +{player.tempPoints}:
                            </span>
                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1px' }}>
                              {Array.from({ length: Math.min(Math.ceil(player.tempPoints / 10), 5) }).map((_, i) => (
                                <span
                                  key={i}
                                  style={{
                                    display: 'inline-block',
                                    width: '8px',
                                    height: `${10 + i * 2}px`,
                                    background: 'linear-gradient(135deg, #fff 0%, #f0f0f0 100%)',
                                    border: '1px solid #333',
                                    borderRadius: '1px',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
                                  }}
                                />
                              ))}
                              {player.tempPoints >= 50 && (
                                <span style={{ fontSize: '10px', marginLeft: '2px' }}>💎</span>
                              )}
                            </div>
                          </div>
                        )}
                        <span style={{ fontSize: '11px' }}>
                          <strong>Total:</strong> {player.totalPoints}
                        </span>
                      </div>
                    </div>
                  );
                })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Area - Player's Hand (spans all columns during playing) */}
        {currentPlayer && gameState.gameStatus === 'playing' && (
          <div style={{
            gridColumn: '1 / -1',
            gridRow: '3',
            padding: isMyTurnNow ? '16px' : '12px',
            borderRadius: '16px',
            border: isMyTurnNow ? `4px solid ${theme.primaryColor}` : `2px solid ${theme.panelBorder}`,
            backgroundColor: `${theme.primaryColor}10`,
            transition: 'all 0.3s ease',
            position: 'relative',
          }}>
            {isMyTurnNow && (
              <div style={{
                position: 'absolute',
                top: '-12px',
                left: '50%',
                transform: 'translateX(-50%)',
                backgroundColor: theme.primaryColor,
                color: '#fff',
                padding: '6px 20px',
                borderRadius: '16px',
                fontWeight: 'bold',
                fontSize: '14px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                animation: 'pulse 1.5s ease-in-out infinite',
              }}>
                👉 YOUR TURN 👈
              </div>
            )}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px',
              marginTop: isMyTurnNow ? '8px' : '0',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '16px' }}>Your Hand ({sortedHand.length} cards)</h3>
                {currentPlayer && (
                  <div style={{ display: 'flex', gap: '12px', fontSize: '13px' }}>
                    {currentPlayer.tempPoints > 0 && (
                      <span style={{
                        padding: '4px 10px',
                        backgroundColor: theme.secondaryColor,
                        color: '#fff',
                        borderRadius: '8px',
                        fontWeight: 'bold',
                      }}>
                        +{currentPlayer.tempPoints} pts
                      </span>
                    )}
                    <span style={{
                      padding: '4px 10px',
                      backgroundColor: theme.primaryColor,
                      color: gameState.theme === 'space' || gameState.theme === 'neon' ? '#fff' : '#000',
                      borderRadius: '8px',
                      fontWeight: 'bold',
                    }}>
                      Total: {currentPlayer.totalPoints} pts
                    </span>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: '#666', fontWeight: 600 }}>Sort:</span>
                <button
                  onClick={handleSortByRank}
                  className="pixel-button"
                  style={{
                    padding: '5px 12px',
                    fontSize: '10px',
                    backgroundColor: theme.panelBg,
                    color: '#666',
                    border: `2px solid ${theme.panelBorder}`,
                  }}
                >
                  Rank
                </button>
                <button
                  onClick={handleSortByRecommended}
                  className="pixel-button"
                  style={{
                    padding: '5px 12px',
                    fontSize: '10px',
                    backgroundColor: theme.primaryColor,
                    color: gameState.theme === 'space' || gameState.theme === 'neon' ? '#fff' : '#000',
                  }}
                >
                  Recommended
                </button>
              </div>
            </div>

            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '5px',
              marginBottom: '12px',
              minHeight: '130px',
              maxHeight: '150px',
              overflowY: 'auto',
              overflowX: 'hidden',
              padding: '8px',
              paddingTop: '24px',
            }}>
              {sortedHand.map(card => (
                <Card
                  key={card.id}
                  card={card}
                  selected={selectedCards.includes(card.id)}
                  onClick={() => toggleCardSelection(card.id)}
                  draggable={true}
                  onDragStart={handleDragStart(card.id)}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop(card.id)}
                />
              ))}
            </div>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {(() => {
                const playError = getPlayError();
                const canPlay = playError === null;

                return (
                  <button
                    onClick={handlePlay}
                    disabled={!canPlay}
                    className="pixel-button"
                    style={{
                      backgroundColor: canPlay ? theme.secondaryColor : '#95a5a6',
                      color: '#fff',
                      opacity: canPlay ? 1 : 0.7,
                      fontSize: '14px',
                      padding: '14px 28px',
                      flex: 1,
                      minWidth: '180px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <span style={{ fontSize: '16px' }}>
                      🎴 Play Selected ({selectedCards.length})
                    </span>
                    {playError && (
                      <span style={{
                        fontSize: '11px',
                        opacity: 0.9,
                        fontWeight: 'normal',
                        textTransform: 'none',
                      }}>
                        {playError}
                      </span>
                    )}
                  </button>
                );
              })()}

              <button
                onClick={handlePass}
                disabled={!isMyTurnNow || !gameState.currentHand}
                className="pixel-button"
                style={{
                  backgroundColor: isMyTurnNow && gameState.currentHand ? '#e67e22' : '#95a5a6',
                  color: '#fff',
                  fontSize: '16px',
                  padding: '14px 28px',
                  flex: 1,
                  minWidth: '140px',
                  opacity: !isMyTurnNow || !gameState.currentHand ? 0.7 : 1,
                }}
              >
                ⏭️ Pass
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Creator Credit */}
      <div style={{
        position: 'fixed',
        bottom: '12px',
        right: '16px',
        fontSize: '11px',
        color: 'rgba(0, 0, 0, 0.4)',
        fontWeight: 600,
        textShadow: '0 1px 2px rgba(255, 255, 255, 0.8)',
        zIndex: 1000,
      }}>
        Created by Alan Zhao
      </div>
    </div>
  );
}
