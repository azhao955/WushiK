import type { Card, HandType, PlayedHand, Suit, Rank } from '../types/game';

// Card ranking order (lowest to highest)
const RANK_ORDER = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
const SUIT_ORDER: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades'];

export function getCardValue(card: Card): number {
  if (card.isJoker) {
    return card.jokerType === 'small' ? 100 : 101;
  }
  return RANK_ORDER.indexOf(card.rank!);
}

export function getCardPoints(card: Card): number {
  if (card.rank === '5') return 5;
  if (card.rank === '10') return 10;
  if (card.rank === 'K') return 10;
  return 0;
}

// Validate if selected cards form a valid hand
export function validateHand(cards: Card[]): HandType | null {
  if (cards.length === 0) return null;

  // Sort cards by value
  const sorted = [...cards].sort((a, b) => getCardValue(a) - getCardValue(b));

  // Single
  if (cards.length === 1) return 'single';

  // Pair
  if (cards.length === 2 && sorted[0].rank === sorted[1].rank) return 'pair';

  // Triple
  if (cards.length === 3 && sorted[0].rank === sorted[1].rank && sorted[1].rank === sorted[2].rank) {
    return 'triple';
  }

  // WuShiK (Five, Ten, King)
  if (cards.length === 3) {
    const ranks = sorted.map(c => c.rank);
    const hasWuShiK = ranks.includes('5') && ranks.includes('10') && ranks.includes('K');
    if (hasWuShiK) {
      return 'wushik';
    }
  }

  // Bomb (4+ of a kind)
  if (cards.length >= 4) {
    const allSameRank = sorted.every(c => c.rank === sorted[0].rank && !c.isJoker);
    if (allSameRank) return 'bomb';
  }

  // Straight (5+ consecutive cards)
  if (cards.length >= 5) {
    const isStraight = sorted.every((card, idx) => {
      if (idx === 0) return true;
      if (card.isJoker) return false;
      return getCardValue(card) === getCardValue(sorted[idx - 1]) + 1;
    });
    if (isStraight) return 'straight';
  }

  // Triple Double (3+ consecutive pairs)
  if (cards.length >= 6 && cards.length % 2 === 0) {
    const pairs: number[] = [];
    for (let i = 0; i < sorted.length; i += 2) {
      if (sorted[i].rank !== sorted[i + 1]?.rank) return null;
      pairs.push(getCardValue(sorted[i]));
    }

    const isConsecutive = pairs.every((val, idx) => {
      if (idx === 0) return true;
      return val === pairs[idx - 1] + 1;
    });

    if (isConsecutive && pairs.length >= 3) return 'triple-double';
  }

  return null;
}

// Check if hand A can beat hand B
export function canBeatHand(newHand: PlayedHand, currentHand: PlayedHand): boolean {
  const newType = newHand.type;
  const currentType = currentHand.type;

  // Power combos (WuShiK and Bombs) can beat anything
  if (newType === 'bomb' || newType === 'wushik') {
    if (currentType !== 'bomb' && currentType !== 'wushik') return true;

    // Compare power combos
    if (newType === 'wushik' && currentType === 'wushik') {
      return compareWuShiK(newHand.cards, currentHand.cards);
    }

    if (newType === 'bomb' && currentType === 'bomb') {
      return compareBombs(newHand.cards, currentHand.cards);
    }

    // WuShiK beats bomb
    if (newType === 'wushik' && currentType === 'bomb') return false;
    if (newType === 'bomb' && currentType === 'wushik') return true;
  }

  // Regular hands must match type
  if (newType !== currentType) return false;

  // Must have same number of cards
  if (newHand.cards.length !== currentHand.cards.length) return false;

  // Compare highest card
  const newHighest = Math.max(...newHand.cards.map(getCardValue));
  const currentHighest = Math.max(...currentHand.cards.map(getCardValue));

  return newHighest > currentHighest;
}

function compareWuShiK(newCards: Card[], currentCards: Card[]): boolean {
  // Same suit WuShiK beats different suit WuShiK
  const newSameSuit = isSameSuitWuShiK(newCards);
  const currentSameSuit = isSameSuitWuShiK(currentCards);

  if (newSameSuit && !currentSameSuit) return true;
  if (!newSameSuit && currentSameSuit) return false;

  // If both same suit, compare by suit order
  if (newSameSuit && currentSameSuit) {
    const newSuit = newCards[0].suit!;
    const currentSuit = currentCards[0].suit!;
    return SUIT_ORDER.indexOf(newSuit) > SUIT_ORDER.indexOf(currentSuit);
  }

  return false; // Different suit WuShiKs are equal
}

function isSameSuitWuShiK(cards: Card[]): boolean {
  const suits = cards.map(c => c.suit);
  return suits.every(s => s === suits[0]);
}

function compareBombs(newCards: Card[], currentCards: Card[]): boolean {
  // 5-card bombs beat all 4-card bombs
  if (newCards.length > currentCards.length) return true;
  if (newCards.length < currentCards.length) return false;

  // Same length: compare by rank
  const newRank = getCardValue(newCards[0]);
  const currentRank = getCardValue(currentCards[0]);
  return newRank > currentRank;
}

// Create a standard deck with jokers
export function createDeck(numDecks: number): Card[] {
  const deck: Card[] = [];

  for (let d = 0; d < numDecks; d++) {
    const suits: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades'];
    const ranks: Rank[] = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];

    for (const suit of suits) {
      for (const rank of ranks) {
        deck.push({
          id: `${d}-${suit}-${rank}`,
          suit,
          rank,
          isJoker: false,
        });
      }
    }

    // Add jokers
    deck.push({
      id: `${d}-joker-small`,
      isJoker: true,
      jokerType: 'small',
    });
    deck.push({
      id: `${d}-joker-big`,
      isJoker: true,
      jokerType: 'big',
    });
  }

  return shuffleDeck(deck);
}

function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Find player with 3 of spades
export function findThreeOfSpades(hands: Card[][]): number {
  for (let i = 0; i < hands.length; i++) {
    const has3Spades = hands[i].some(
      card => !card.isJoker && card.rank === '3' && card.suit === 'spades'
    );
    if (has3Spades) return i;
  }
  return 0; // Shouldn't happen
}

// Deal cards to players
export function dealCards(deck: Card[], numPlayers: number): Card[][] {
  const hands: Card[][] = Array.from({ length: numPlayers }, () => []);

  deck.forEach((card, idx) => {
    hands[idx % numPlayers].push(card);
  });

  return hands;
}

// Sort cards by rank order (3 → 2, jokers at end)
export function sortByRank(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    if (a.isJoker && b.isJoker) {
      return a.jokerType === 'small' ? -1 : 1;
    }
    if (a.isJoker) return 1;
    if (b.isJoker) return -1;
    return getCardValue(a) - getCardValue(b);
  });
}

// Sort cards by recommended order (combos grouped)
export function sortByRecommended(cards: Card[]): Card[] {
  const sorted = [...cards];

  // Group cards by rank
  const rankGroups = new Map<string, Card[]>();
  const jokers: Card[] = [];

  sorted.forEach(card => {
    if (card.isJoker) {
      jokers.push(card);
    } else {
      const key = card.rank!;
      if (!rankGroups.has(key)) rankGroups.set(key, []);
      rankGroups.get(key)!.push(card);
    }
  });

  // Check for WuShiK combo (5, 10, K)
  const has5 = rankGroups.get('5') || [];
  const has10 = rankGroups.get('10') || [];
  const hasK = rankGroups.get('K') || [];
  const wushikCards: Card[] = [];

  if (has5.length > 0 && has10.length > 0 && hasK.length > 0) {
    wushikCards.push(has5[0], has10[0], hasK[0]);
    // Remove one of each from the groups
    if (has5.length === 1) rankGroups.delete('5');
    else rankGroups.set('5', has5.slice(1));

    if (has10.length === 1) rankGroups.delete('10');
    else rankGroups.set('10', has10.slice(1));

    if (hasK.length === 1) rankGroups.delete('K');
    else rankGroups.set('K', hasK.slice(1));
  }

  // Organize by combo type
  const singles: Card[] = [];
  const pairs: Card[] = [];
  const triples: Card[] = [];
  const quads: Card[] = [];

  // Sort each group by rank value
  const sortedRanks = Array.from(rankGroups.entries())
    .sort((a, b) => getCardValue(a[1][0]) - getCardValue(b[1][0]));

  sortedRanks.forEach(([_, cards]) => {
    if (cards.length === 1) singles.push(...cards);
    else if (cards.length === 2) pairs.push(...cards);
    else if (cards.length === 3) triples.push(...cards);
    else if (cards.length >= 4) quads.push(...cards);
  });

  // Combine: singles, pairs, triples, then power combos (WuShiK, bombs, jokers) at end
  return [...singles, ...pairs, ...triples, ...wushikCards, ...quads, ...jokers];
}
