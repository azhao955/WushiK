import { useState } from 'react';
import { themes } from '../lib/themes';

interface LobbyProps {
  onJoinGame: (
    gameId: string,
    playerName: string,
    config?: {
      targetPoints: number;
      theme: string;
      aiPlayers: number;
      aiDifficulty: 'easy' | 'medium' | 'hard';
    }
  ) => void;
}

export function Lobby({ onJoinGame }: LobbyProps) {
  const [playerName, setPlayerName] = useState('');
  const [gameId, setGameId] = useState('');
  const [targetPoints, setTargetPoints] = useState(100);
  const [theme, setTheme] = useState('default');
  const [aiPlayers, setAiPlayers] = useState(0);
  const [aiDifficulty, setAiDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');

  const handleCreateGame = () => {
    if (!playerName.trim()) {
      alert('Please enter your name!');
      return;
    }

    const newGameId = Math.random().toString(36).substring(2, 8).toUpperCase();
    onJoinGame(newGameId, playerName, { targetPoints, theme, aiPlayers, aiDifficulty });
  };

  const handleJoinGame = () => {
    if (!playerName.trim()) {
      alert('Please enter your name!');
      return;
    }

    if (!gameId.trim()) {
      alert('Please enter a game ID!');
      return;
    }

    onJoinGame(gameId.toUpperCase(), playerName);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '20px',
      }}
    >
      {/* Floating cards decoration */}
      <div style={{
        position: 'absolute',
        top: '10%',
        left: '10%',
        fontSize: '48px',
        animation: 'float 3s ease-in-out infinite',
      }}>
        🎴
      </div>
      <div style={{
        position: 'absolute',
        top: '20%',
        right: '15%',
        fontSize: '48px',
        animation: 'float 4s ease-in-out infinite 0.5s',
      }}>
        🃏
      </div>
      <div style={{
        position: 'absolute',
        bottom: '15%',
        left: '15%',
        fontSize: '48px',
        animation: 'float 3.5s ease-in-out infinite 1s',
      }}>
        ♠️
      </div>

      <div
        style={{
          background: '#fff',
          padding: '40px',
          border: '6px solid #000',
          borderRadius: '24px',
          boxShadow: '0 12px 0 rgba(0, 0, 0, 0.3)',
          maxWidth: '600px',
          width: '100%',
          position: 'relative',
          zIndex: 1,
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        {/* Title */}
        <div style={{
          textAlign: 'center',
          marginBottom: '40px',
        }}>
          <h1 style={{
            fontSize: '48px',
            margin: '0 0 10px 0',
            color: '#ff6b6b',
            textShadow: '3px 3px 0 rgba(0, 0, 0, 0.1)',
            animation: 'pulse 2s ease-in-out infinite',
            fontWeight: 800,
          }}>
            WuShiK
          </h1>
          <p style={{
            fontSize: '14px',
            color: '#764ba2',
            margin: 0,
            textTransform: 'uppercase',
            fontWeight: 600,
            letterSpacing: '2px',
          }}>
            Card Battle Royale
          </p>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{
            display: 'block',
            marginBottom: '8px',
            fontSize: '12px',
            color: '#666',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '1px',
          }}>
            Your Name
          </label>
          <input
            type="text"
            value={playerName}
            onChange={e => setPlayerName(e.target.value)}
            placeholder="Enter your name"
            style={{
              width: '100%',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{
            display: 'block',
            marginBottom: '8px',
            fontSize: '12px',
            color: '#666',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '1px',
          }}>
            Target Score
          </label>
          <input
            type="number"
            value={targetPoints}
            onChange={e => setTargetPoints(Math.max(50, parseInt(e.target.value) || 100))}
            min="50"
            step="50"
            style={{
              width: '100%',
              boxSizing: 'border-box',
            }}
          />
          <p style={{ margin: '5px 0 0 0', fontSize: '11px', color: '#999' }}>
            First player to reach this score wins
          </p>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{
            display: 'block',
            marginBottom: '8px',
            fontSize: '12px',
            color: '#666',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '1px',
          }}>
            Theme
          </label>
          <select
            value={theme}
            onChange={e => setTheme(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 16px',
              fontSize: '16px',
              border: '3px solid #000',
              borderRadius: '8px',
              background: '#fff',
              cursor: 'pointer',
              fontFamily: 'Poppins, sans-serif',
            }}
          >
            {Object.entries(themes).map(([key, themeData]) => (
              <option key={key} value={key}>
                {themeData.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{
            display: 'block',
            marginBottom: '8px',
            fontSize: '12px',
            color: '#666',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '1px',
          }}>
            Computer Players
          </label>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              type="number"
              value={aiPlayers}
              onChange={e => setAiPlayers(Math.max(0, Math.min(6, parseInt(e.target.value) || 0)))}
              min="0"
              max="6"
              style={{
                flex: 1,
                boxSizing: 'border-box',
              }}
            />
            <select
              value={aiDifficulty}
              onChange={e => setAiDifficulty(e.target.value as 'easy' | 'medium' | 'hard')}
              style={{
                flex: 1,
                padding: '12px 16px',
                fontSize: '16px',
                border: '3px solid #000',
                borderRadius: '8px',
                background: '#fff',
                cursor: 'pointer',
                fontFamily: 'Poppins, sans-serif',
              }}
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
          <p style={{ margin: '5px 0 0 0', fontSize: '11px', color: '#999' }}>
            Add AI opponents (0-6) and select difficulty
          </p>
        </div>

        <div style={{ marginBottom: '25px' }}>
          <button
            onClick={handleCreateGame}
            className="pixel-button"
            style={{
              width: '100%',
              backgroundColor: '#4ecdc4',
              color: '#000',
            }}
          >
            🎮 Create New Game
          </button>
        </div>

        <div style={{
          textAlign: 'center',
          margin: '30px 0',
          fontSize: '14px',
          color: '#bbb',
          fontWeight: 600,
          position: 'relative',
        }}>
          <div style={{
            position: 'absolute',
            top: '50%',
            left: 0,
            right: 0,
            height: '2px',
            background: '#e0e0e0',
            zIndex: 0,
          }}></div>
          <span style={{
            background: '#fff',
            padding: '0 20px',
            position: 'relative',
            zIndex: 1,
          }}>OR</span>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{
            display: 'block',
            marginBottom: '8px',
            fontSize: '12px',
            color: '#666',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '1px',
          }}>
            Game Code
          </label>
          <input
            type="text"
            value={gameId}
            onChange={e => setGameId(e.target.value)}
            placeholder="Enter 6-digit code"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              textTransform: 'uppercase',
            }}
          />
        </div>

        <button
          onClick={handleJoinGame}
          className="pixel-button"
          style={{
            width: '100%',
            backgroundColor: '#ff6b6b',
            color: '#fff',
          }}
        >
          👥 Join Existing Game
        </button>

        <div
          style={{
            marginTop: '30px',
            padding: '20px',
            background: 'linear-gradient(135deg, #fff3cd 0%, #ffe9a6 100%)',
            border: '3px solid #000',
            borderRadius: '12px',
            fontSize: '13px',
            lineHeight: '1.6',
          }}
        >
          <div style={{ marginBottom: '12px', fontWeight: 700, color: '#856404', fontSize: '14px' }}>
            ⚡ Quick Rules
          </div>
          <ul style={{ margin: '0', paddingLeft: '20px' }}>
            <li style={{ marginBottom: '6px' }}>Need 3+ players to start</li>
            <li style={{ marginBottom: '6px' }}>Collect 5s (5pts), 10s (10pts), Kings (10pts)</li>
            <li style={{ marginBottom: '6px' }}>30 seconds per turn</li>
            <li>First to target score wins!</li>
          </ul>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        marginTop: '30px',
        fontSize: '12px',
        color: '#fff',
        textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
        fontWeight: 600,
        opacity: 0.8,
      }}>
        Ready to play?
      </div>
    </div>
  );
}
