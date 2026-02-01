import type { Card as CardType } from '../types/game';

interface CardProps {
  card: CardType;
  selected?: boolean;
  onClick?: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  small?: boolean;
}

export const suitSymbols = {
  clubs: '♣',
  diamonds: '♦',
  hearts: '♥',
  spades: '♠',
};

// Helper function to get card display string (e.g., "K♠" or "5♥")
export function getCardDisplayString(card: CardType): string {
  if (card.isJoker) {
    return card.jokerType === 'big' ? 'Red Joker' : 'Black Joker';
  }
  return `${card.rank}${suitSymbols[card.suit!]}`;
}

// Helper to check if suit is red
export function isRedSuit(card: CardType): boolean {
  return card.suit === 'hearts' || card.suit === 'diamonds';
}

export function Card({ card, selected, onClick, draggable, onDragStart, onDragOver, onDrop, small }: CardProps) {
  // Get card code for Deck of Cards API
  const getCardCode = () => {
    if (card.isJoker) {
      return card.jokerType === 'big' ? 'X1' : 'X2';
    }

    const rankMap: { [key: string]: string } = {
      'A': 'A', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6',
      '7': '7', '8': '8', '9': '9', '10': '0', 'J': 'J', 'Q': 'Q', 'K': 'K'
    };

    const suitMap = {
      'spades': 'S',
      'hearts': 'H',
      'diamonds': 'D',
      'clubs': 'C'
    };

    return `${rankMap[card.rank!]}${suitMap[card.suit!]}`;
  };

  const cardCode = getCardCode();
  const imageUrl = `https://deckofcardsapi.com/static/img/${cardCode}.png`;

  const width = small ? '50px' : '70px';
  const height = small ? '70px' : '98px';

  return (
    <div
      className={selected ? 'selected' : ''}
      onClick={onClick}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      style={{
        width,
        height,
        borderRadius: '6px',
        border: selected ? '4px solid #3498db' : 'none',
        boxShadow: selected
          ? '0 12px 24px rgba(52, 152, 219, 0.8), 0 0 0 5px rgba(52, 152, 219, 0.4), 0 0 30px rgba(52, 152, 219, 0.3)'
          : '0 2px 6px rgba(0, 0, 0, 0.3)',
        cursor: onClick ? 'pointer' : draggable ? 'grab' : 'default',
        position: 'relative',
        transition: 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
        transform: selected ? 'translateY(-20px) scale(1.1)' : 'none',
        userSelect: 'none',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      <img
        src={imageUrl}
        alt={card.isJoker ? `${card.jokerType} joker` : `${card.rank} of ${card.suit}`}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          pointerEvents: 'none',
          display: 'block',
        }}
        onError={(e) => {
          // Fallback if image fails to load
          e.currentTarget.style.display = 'none';
        }}
      />
    </div>
  );
}
