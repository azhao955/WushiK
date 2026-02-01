import type { Card as CardType } from '../types/game';

interface CardProps {
  card: CardType;
  selected?: boolean;
  onClick?: () => void;
}

const suitSymbols = {
  clubs: '♣',
  diamonds: '♦',
  hearts: '♥',
  spades: '♠',
};

const suitColors = {
  clubs: '#000',
  diamonds: '#e74c3c',
  hearts: '#e74c3c',
  spades: '#000',
};

export function Card({ card, selected, onClick }: CardProps) {
  const getSuitDisplay = () => {
    if (card.isJoker) {
      return card.jokerType === 'small' ? '🃏' : '🃏';
    }
    return suitSymbols[card.suit!];
  };

  const getColor = () => {
    if (card.isJoker) {
      return card.jokerType === 'small' ? '#000' : '#e74c3c';
    }
    return suitColors[card.suit!];
  };

  const getDisplay = () => {
    if (card.isJoker) {
      return card.jokerType === 'small' ? 'Small Joker' : 'Big Joker';
    }
    return `${card.rank}${getSuitDisplay()}`;
  };

  return (
    <div
      onClick={onClick}
      style={{
        width: '80px',
        height: '112px',
        border: `2px solid ${selected ? '#3498db' : '#34495e'}`,
        borderRadius: '8px',
        backgroundColor: selected ? '#ecf0f1' : '#fff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: onClick ? 'pointer' : 'default',
        color: getColor(),
        fontSize: card.isJoker ? '12px' : '24px',
        fontWeight: 'bold',
        margin: '0 4px',
        boxShadow: selected ? '0 4px 8px rgba(0,0,0,0.2)' : '0 2px 4px rgba(0,0,0,0.1)',
        transform: selected ? 'translateY(-10px)' : 'none',
        transition: 'all 0.2s ease',
      }}
    >
      {getDisplay()}
    </div>
  );
}
