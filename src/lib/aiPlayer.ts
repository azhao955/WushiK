import type { Card, HandType, Player, PlayedHand } from '../types/game';
import { validateHand, canBeatHand, getCardValue } from './gameLogic';

export type Difficulty = 'easy' | 'medium' | 'hard';

// AI decision making for computer players
export function makeAIMove(
  player: Player,
  currentHand: PlayedHand | null,
  difficulty: Difficulty
): { action: 'play' | 'pass'; cards?: Card[] } {
  if (currentHand === null) {
    // Start a new trick - play lowest card(s)
    return playStartingHand(player, difficulty);
  }

  // Try to beat the current hand
  const beatingHand = findBeatingHand(player, currentHand, difficulty);

  if (beatingHand) {
    // Difficulty affects whether AI plays or passes strategically
    const shouldPlay = shouldAIPlay(player, currentHand, beatingHand, difficulty);
    if (shouldPlay) {
      return { action: 'play', cards: beatingHand };
    }
  }

  return { action: 'pass' };
}

function playStartingHand(player: Player, difficulty: Difficulty): { action: 'play'; cards: Card[] } {
  const sortedCards = [...player.hand].sort((a, b) => getCardValue(a) - getCardValue(b));

  if (difficulty === 'easy') {
    // Play single lowest card
    return { action: 'play', cards: [sortedCards[0]] };
  }

  if (difficulty === 'medium') {
    // Try to play pairs or triples if available
    const pairs = findPairs(sortedCards);
    if (pairs.length > 0) {
      return { action: 'play', cards: pairs[0] };
    }
    return { action: 'play', cards: [sortedCards[0]] };
  }

  // Hard: Look for strategic plays
  const triples = findTriples(sortedCards);
  if (triples.length > 0) {
    return { action: 'play', cards: triples[0] };
  }

  const pairs = findPairs(sortedCards);
  if (pairs.length > 0) {
    return { action: 'play', cards: pairs[0] };
  }

  return { action: 'play', cards: [sortedCards[0]] };
}

function findBeatingHand(
  player: Player,
  currentHand: PlayedHand,
  difficulty: Difficulty
): Card[] | null {
  const handType = currentHand.type;

  // Find all possible plays of the same type
  const possiblePlays = findHandsOfType(player.hand, handType);

  // Filter to only those that beat current hand
  const beatingPlays = possiblePlays.filter(cards => {
    const testHand: PlayedHand = {
      cards,
      type: handType,
      playerId: player.id,
      playerName: player.name,
    };
    return canBeatHand(testHand, currentHand);
  });

  if (beatingPlays.length === 0) {
    // Try bombs or WuShiK if no regular play works
    const powerPlays = findPowerCombos(player.hand);
    for (const cards of powerPlays) {
      const type = validateHand(cards);
      if (type === 'bomb' || type === 'wushik') {
        const testHand: PlayedHand = {
          cards,
          type,
          playerId: player.id,
          playerName: player.name,
        };
        if (canBeatHand(testHand, currentHand)) {
          return cards;
        }
      }
    }
    return null;
  }

  // Choose which beating play to use based on difficulty
  if (difficulty === 'easy') {
    // Play highest beating hand (wasteful)
    return beatingPlays[beatingPlays.length - 1];
  }

  if (difficulty === 'medium') {
    // Play middle option
    const midIdx = Math.floor(beatingPlays.length / 2);
    return beatingPlays[midIdx];
  }

  // Hard: Play lowest beating hand (efficient)
  return beatingPlays[0];
}

function shouldAIPlay(
  player: Player,
  currentHand: PlayedHand,
  beatingHand: Card[],
  difficulty: Difficulty
): boolean {
  if (difficulty === 'easy') {
    // Easy: Always play if possible
    return true;
  }

  if (difficulty === 'medium') {
    // Medium: 70% chance to play
    return Math.random() < 0.7;
  }

  // Hard: Strategic decision
  // Don't waste good cards on low-value tricks
  const highCards = beatingHand.filter(c => getCardValue(c) > 10);
  const hasHighCards = highCards.length > 0;
  const trickIsValuable = currentHand.cards.length > 3;

  if (hasHighCards && !trickIsValuable && player.hand.length > 5) {
    // Save high cards for later
    return Math.random() < 0.3;
  }

  return true;
}

function findHandsOfType(hand: Card[], type: HandType): Card[][] {
  const results: Card[][] = [];

  if (type === 'single') {
    return hand.map(c => [c]);
  }

  if (type === 'pair') {
    const ranks = new Map<string, Card[]>();
    hand.forEach(card => {
      if (!card.isJoker) {
        const key = card.rank!;
        if (!ranks.has(key)) ranks.set(key, []);
        ranks.get(key)!.push(card);
      }
    });

    ranks.forEach(cards => {
      if (cards.length >= 2) {
        results.push(cards.slice(0, 2));
      }
    });
  }

  if (type === 'triple') {
    const ranks = new Map<string, Card[]>();
    hand.forEach(card => {
      if (!card.isJoker) {
        const key = card.rank!;
        if (!ranks.has(key)) ranks.set(key, []);
        ranks.get(key)!.push(card);
      }
    });

    ranks.forEach(cards => {
      if (cards.length >= 3) {
        results.push(cards.slice(0, 3));
      }
    });
  }

  return results.sort((a, b) => getCardValue(a[0]) - getCardValue(b[0]));
}

function findPairs(hand: Card[]): Card[][] {
  const ranks = new Map<string, Card[]>();
  hand.forEach(card => {
    if (!card.isJoker) {
      const key = card.rank!;
      if (!ranks.has(key)) ranks.set(key, []);
      ranks.get(key)!.push(card);
    }
  });

  const pairs: Card[][] = [];
  ranks.forEach(cards => {
    if (cards.length >= 2) {
      pairs.push(cards.slice(0, 2));
    }
  });

  return pairs.sort((a, b) => getCardValue(a[0]) - getCardValue(b[0]));
}

function findTriples(hand: Card[]): Card[][] {
  const ranks = new Map<string, Card[]>();
  hand.forEach(card => {
    if (!card.isJoker) {
      const key = card.rank!;
      if (!ranks.has(key)) ranks.set(key, []);
      ranks.get(key)!.push(card);
    }
  });

  const triples: Card[][] = [];
  ranks.forEach(cards => {
    if (cards.length >= 3) {
      triples.push(cards.slice(0, 3));
    }
  });

  return triples.sort((a, b) => getCardValue(a[0]) - getCardValue(b[0]));
}

function findPowerCombos(hand: Card[]): Card[][] {
  const combos: Card[][] = [];

  // Find bombs (4+ of a kind)
  const ranks = new Map<string, Card[]>();
  hand.forEach(card => {
    if (!card.isJoker) {
      const key = card.rank!;
      if (!ranks.has(key)) ranks.set(key, []);
      ranks.get(key)!.push(card);
    }
  });

  ranks.forEach(cards => {
    if (cards.length >= 4) {
      combos.push(cards);
    }
  });

  // Find WuShiK combos (5, 10, K)
  const fives = hand.filter(c => !c.isJoker && c.rank === '5');
  const tens = hand.filter(c => !c.isJoker && c.rank === '10');
  const kings = hand.filter(c => !c.isJoker && c.rank === 'K');

  if (fives.length > 0 && tens.length > 0 && kings.length > 0) {
    combos.push([fives[0], tens[0], kings[0]]);
  }

  return combos;
}
