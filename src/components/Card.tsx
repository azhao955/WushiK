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

export function Card({ card, selected, onClick, draggable, onDragStart, onDragOver, onDrop }: CardProps) {
  const isRed = card.suit === 'diamonds' || card.suit === 'hearts';
  // Small joker = black, big joker = red
  const color = card.isJoker
    ? card.jokerType === 'big' ? '#e74c3c' : '#000'
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

  const getSuitSymbolCount = () => {
    if (card.isJoker || !card.rank) return 0;
    const rankMap: { [key: string]: number } = {
      'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13
    };
    return rankMap[card.rank] || 0;
  };

  const renderSuitSymbols = () => {
    const count = getSuitSymbolCount();
    const symbol = getSuitSymbol();
    if (!symbol || count === 0) return null;

    // For face cards and 10, show a simplified pattern
    if (count > 10) {
      return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '2px', fontSize: '14px' }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ color }}>{symbol}</div>
          ))}
        </div>
      );
    }

    // For number cards, show actual count
    const positions: { [key: number]: React.CSSProperties[] } = {
      1: [{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }],
      2: [{ top: '30%', left: '50%', transform: 'translate(-50%, -50%)' }, { top: '70%', left: '50%', transform: 'translate(-50%, -50%)' }],
      3: [{ top: '25%', left: '50%', transform: 'translate(-50%, -50%)' }, { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }, { top: '75%', left: '50%', transform: 'translate(-50%, -50%)' }],
      4: [{ top: '30%', left: '30%' }, { top: '30%', right: '30%' }, { bottom: '30%', left: '30%' }, { bottom: '30%', right: '30%' }],
      5: [{ top: '25%', left: '30%' }, { top: '25%', right: '30%' }, { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }, { bottom: '25%', left: '30%' }, { bottom: '25%', right: '30%' }],
      6: [{ top: '25%', left: '30%' }, { top: '25%', right: '30%' }, { top: '50%', left: '30%' }, { top: '50%', right: '30%' }, { bottom: '25%', left: '30%' }, { bottom: '25%', right: '30%' }],
      7: [{ top: '20%', left: '30%' }, { top: '20%', right: '30%' }, { top: '40%', left: '30%' }, { top: '40%', left: '50%', transform: 'translateX(-50%)' }, { top: '40%', right: '30%' }, { bottom: '20%', left: '30%' }, { bottom: '20%', right: '30%' }],
      8: [{ top: '20%', left: '30%' }, { top: '20%', right: '30%' }, { top: '40%', left: '30%' }, { top: '40%', right: '30%' }, { bottom: '40%', left: '30%' }, { bottom: '40%', right: '30%' }, { bottom: '20%', left: '30%' }, { bottom: '20%', right: '30%' }],
      9: [{ top: '20%', left: '25%' }, { top: '20%', right: '25%' }, { top: '35%', left: '25%' }, { top: '35%', right: '25%' }, { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }, { bottom: '35%', left: '25%' }, { bottom: '35%', right: '25%' }, { bottom: '20%', left: '25%' }, { bottom: '20%', right: '25%' }],
      10: [{ top: '18%', left: '25%' }, { top: '18%', right: '25%' }, { top: '35%', left: '25%' }, { top: '35%', right: '25%' }, { top: '50%', left: '25%' }, { top: '50%', right: '25%' }, { bottom: '35%', left: '25%' }, { bottom: '35%', right: '25%' }, { bottom: '18%', left: '25%' }, { bottom: '18%', right: '25%' }],
    };

    return (
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        {positions[count]?.map((pos, i) => (
          <div key={i} style={{ position: 'absolute', ...pos, fontSize: '16px', color }}>
            {symbol}
          </div>
        ))}
      </div>
    );
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
          <div style={{ fontSize: '42px' }}>
            🃏
          </div>
          <div style={{
            fontSize: '9px',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            marginTop: '-6px',
          }}>
            {card.jokerType === 'big' ? 'Red' : 'Black'}
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
            zIndex: 2,
          }}>
            <div style={{
              fontSize: '16px',
              fontWeight: 'bold',
              color: color,
            }}>
              {getRankDisplay()}
            </div>
            <div style={{
              fontSize: '12px',
              color: color,
            }}>
              {getSuitSymbol()}
            </div>
          </div>

          {/* Center suit symbols (multiple) */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '50px',
            height: '70px',
          }}>
            {renderSuitSymbols()}
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
            zIndex: 2,
          }}>
            <div style={{
              fontSize: '16px',
              fontWeight: 'bold',
              color: color,
            }}>
              {getRankDisplay()}
            </div>
            <div style={{
              fontSize: '12px',
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
