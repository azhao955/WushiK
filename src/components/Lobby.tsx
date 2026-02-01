import { useState } from 'react';
import { themes, getTheme } from '../lib/themes';

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
  const [aiPlayers, setAiPlayers] = useState<number | ''>(0);
  const [aiDifficulty, setAiDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');

  const currentTheme = getTheme(theme);

  const handleCreateGame = () => {
    if (!playerName.trim()) {
      alert('Please enter your name!');
      return;
    }

    const newGameId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const aiCount = typeof aiPlayers === 'number' ? aiPlayers : 0;
    onJoinGame(newGameId, playerName, { targetPoints, theme, aiPlayers: aiCount, aiDifficulty });
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
        background: currentTheme.background,
        transition: 'background 0.5s ease',
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

      {/* Title */}
      <div style={{
        textAlign: 'center',
        marginBottom: '40px',
        position: 'relative',
        zIndex: 1,
      }}>
        <h1 style={{
          fontSize: '64px',
          margin: '0 0 10px 0',
          color: currentTheme.secondaryColor,
          textShadow: '4px 4px 0 rgba(0, 0, 0, 0.2)',
          animation: 'pulse 2s ease-in-out infinite',
          fontWeight: 800,
        }}>
          WuShiK
        </h1>
        <p style={{
          fontSize: '16px',
          color: currentTheme.primaryColor,
          margin: 0,
          textTransform: 'uppercase',
          fontWeight: 600,
          letterSpacing: '3px',
          textShadow: '2px 2px 0 rgba(0, 0, 0, 0.2)',
        }}>
          Card Battle Royale
        </p>
      </div>

      {/* Main content - side by side */}
      <div style={{
        display: 'flex',
        gap: '30px',
        maxWidth: '1200px',
        width: '100%',
        position: 'relative',
        zIndex: 1,
        flexWrap: 'wrap',
        justifyContent: 'center',
      }}>
        {/* Create Game Panel */}
        <div
          style={{
            background: currentTheme.panelBg,
            padding: '40px',
            border: `6px solid ${currentTheme.panelBorder}`,
            borderRadius: '24px',
            boxShadow: '0 12px 0 rgba(0, 0, 0, 0.3)',
            flex: '1',
            minWidth: '400px',
            maxWidth: '500px',
          }}
        >
          <h2 style={{
            fontSize: '24px',
            marginTop: 0,
            marginBottom: '30px',
            color: currentTheme.primaryColor,
            fontWeight: 700,
          }}>
            🎮 Create New Game
          </h2>

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

          <div style={{ marginBottom: '25px' }}>
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
                onChange={e => {
                  const val = e.target.value;
                  if (val === '') {
                    setAiPlayers('');
                  } else {
                    setAiPlayers(Math.max(0, Math.min(6, parseInt(val) || 0)));
                  }
                }}
                onBlur={e => {
                  if (e.target.value === '') {
                    setAiPlayers(0);
                  }
                }}
                min="0"
                max="6"
                placeholder="Count"
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
          </div>

          <button
            onClick={handleCreateGame}
            className="pixel-button"
            style={{
              width: '100%',
              backgroundColor: currentTheme.primaryColor,
              color: theme === 'space' || theme === 'neon' ? '#fff' : '#000',
            }}
          >
            Create Game
          </button>
        </div>

        {/* Join Game Panel */}
        <div
          style={{
            background: currentTheme.panelBg,
            padding: '40px',
            border: `6px solid ${currentTheme.panelBorder}`,
            borderRadius: '24px',
            boxShadow: '0 12px 0 rgba(0, 0, 0, 0.3)',
            flex: '1',
            minWidth: '400px',
            maxWidth: '500px',
          }}
        >
          <h2 style={{
            fontSize: '24px',
            marginTop: 0,
            marginBottom: '30px',
            color: currentTheme.secondaryColor,
            fontWeight: 700,
          }}>
            👥 Join Existing Game
          </h2>

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

          <div style={{ marginBottom: '25px' }}>
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
                fontSize: '24px',
                textAlign: 'center',
                letterSpacing: '4px',
                fontWeight: 'bold',
              }}
            />
          </div>

          <button
            onClick={handleJoinGame}
            className="pixel-button"
            style={{
              width: '100%',
              backgroundColor: currentTheme.secondaryColor,
              color: '#fff',
            }}
          >
            Join Game
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
              <li style={{ marginBottom: '6px' }}>Collect 5s, 10s, Kings</li>
              <li style={{ marginBottom: '6px' }}>30 seconds per turn</li>
              <li>First to target wins!</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        marginTop: '30px',
        fontSize: '12px',
        color: '#fff',
        textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
        fontWeight: 600,
        opacity: 0.9,
        position: 'relative',
        zIndex: 1,
      }}>
        Select a theme and watch it change!
      </div>

      {/* Creator Credit */}
      <div style={{
        position: 'fixed',
        bottom: '12px',
        right: '16px',
        fontSize: '11px',
        color: 'rgba(255, 255, 255, 0.6)',
        fontWeight: 600,
        textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
        zIndex: 1000,
      }}>
        Created by Alan Zhao
      </div>
    </div>
  );
}
