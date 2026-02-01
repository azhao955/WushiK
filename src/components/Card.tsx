import type { Card as CardType } from '../types/game';

interface CardProps {
  card: CardType;
  selected?: boolean;
  onClick?: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
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

export function Card({ card, selected, onClick, draggable, onDragStart, onDragOver, onDrop }: CardProps) {
  const isRed = card.suit === 'diamonds' || card.suit === 'hearts';
  const color = card.isJoker
    ? card.jokerType === 'small' ? '#000' : '#e74c3c'
    : isRed ? '#e74c3c' : '#000';

  const getRankDisplay = () => {
    if (card.isJoker) return 'JOKER';
    if (card.rank === '10') return '10';
    return card.rank;
  };

  const getSuitSymbol = () => {
    if (card.isJoker) return null;
    return suitSymbols[card.suit!];
  };

  return (
    <div
      onClick={onClick}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      style={{
        width: '70px',
        height: '98px',
        borderRadius: '8px',
        backgroundColor: card.isJoker ? (card.jokerType === 'small' ? '#fff' : '#fff') : '#fff',
        border: selected ? '3px solid #3498db' : '2px solid #000',
        boxShadow: selected
          ? '0 6px 12px rgba(52, 152, 219, 0.4), 0 0 0 4px rgba(52, 152, 219, 0.2)'
          : '0 2px 4px rgba(0, 0, 0, 0.2)',
        cursor: onClick ? 'pointer' : draggable ? 'grab' : 'default',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        padding: '4px',
        transition: 'all 0.2s ease',
        transform: selected ? 'translateY(-12px) scale(1.05)' : 'none',
        userSelect: 'none',
      }}
    >
      {/* Joker Card */}
      {card.isJoker && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: color,
        }}>
          <div style={{ fontSize: '28px', marginBottom: '4px' }}>
            {card.jokerType === 'small' ? '🃏' : '🤡'}
          </div>
          <div style={{
            fontSize: '8px',
            fontWeight: 'bold',
            textTransform: 'uppercase',
          }}>
            {card.jokerType === 'small' ? 'Small' : 'Big'}
          </div>
        </div>
      )}

      {/* Regular Card */}
      {!card.isJoker && (
        <>
          {/* Top left corner */}
          <div style={{
            position: 'absolute',
            top: '4px',
            left: '6px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            lineHeight: 1,
          }}>
            <div style={{
              fontSize: '18px',
              fontWeight: 'bold',
              color: color,
            }}>
              {getRankDisplay()}
            </div>
            <div style={{
              fontSize: '14px',
              color: color,
            }}>
              {getSuitSymbol()}
            </div>
          </div>

          {/* Center suit symbol */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: '32px',
            color: color,
          }}>
            {getSuitSymbol()}
          </div>

          {/* Bottom right corner (upside down) */}
          <div style={{
            position: 'absolute',
            bottom: '4px',
            right: '6px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            lineHeight: 1,
            transform: 'rotate(180deg)',
          }}>
            <div style={{
              fontSize: '18px',
              fontWeight: 'bold',
              color: color,
            }}>
              {getRankDisplay()}
            </div>
            <div style={{
              fontSize: '14px',
              color: color,
            }}>
              {getSuitSymbol()}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
