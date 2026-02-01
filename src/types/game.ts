// Card types
export type Suit = 'clubs' | 'diamonds' | 'hearts' | 'spades';
export type Rank = '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A' | '2';
export type JokerType = 'small' | 'big';

export interface Card {
  id: string;
  suit?: Suit;
  rank?: Rank;
  jokerType?: JokerType;
  isJoker: boolean;
}

// Hand types that can be played
export type HandType =
  | 'single'
  | 'pair'
  | 'triple'
  | 'straight'
  | 'triple-double'
  | 'wushik'
  | 'bomb';

export interface PlayedHand {
  cards: Card[];
  type: HandType;
  playerId: string;
  playerName: string;
}

// Player state
export interface Player {
  id: string;
  name: string;
  hand: Card[];
  tempPoints: number; // Points collected during the round
  totalPoints: number; // Points across all rounds
  hasFinished: boolean; // True when they've played all their cards
  finishPosition?: number; // 1st, 2nd, etc.
  isAI?: boolean; // True if this is a computer player
  firstPlaceCount?: number; // Number of times player finished first
}

// Play log entry
export interface PlayLogEntry {
  playerName: string;
  action: string;
  cards?: Card[];
  time: number;
}

// Game state
export interface GameState {
  id: string;
  players: Player[];
  currentPlayerId: string;
  deck: Card[];
  currentHand: PlayedHand | null;
  playedCards: Card[]; // All cards played in current trick
  passedPlayerIds: string[]; // Players who passed this trick
  roundNumber: number;
  targetPoints: number;
  gameStatus: 'waiting' | 'playing' | 'round-end' | 'round-reveal' | 'game-end';
  winnerId?: string;
  firstPlayerId?: string; // Player with 3 of spades
  lastPlayerId?: string; // Last place player (for round reveal)
  theme?: string; // Theme name
  aiDifficulty?: 'easy' | 'medium' | 'hard'; // AI difficulty level
  turnStartTime?: number; // Timestamp when current turn started
  playLog?: PlayLogEntry[]; // Shared play log synced across all players
}

// Game configuration
export interface GameConfig {
  minPlayers: number;
  maxPlayersPerDeck: number;
  targetPoints: number;
}
