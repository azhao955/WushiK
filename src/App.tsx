import { useState, lazy, Suspense, useEffect } from 'react';
import { Lobby } from './components/Lobby';

// Lazy load the Game component to reduce initial bundle size
const Game = lazy(() => import('./components/Game').then(module => ({ default: module.Game })));

const SESSION_KEY = 'wushik-game-session';

function App() {
  const [gameState, setGameState] = useState<{
    gameId: string;
    playerId: string;
    playerName: string;
    config?: {
      targetPoints: number;
      theme: string;
      aiPlayers: number;
      aiDifficulty: 'easy' | 'medium' | 'hard';
    };
  } | null>(null);

  // Restore session from localStorage on mount
  useEffect(() => {
    const savedSession = localStorage.getItem(SESSION_KEY);
    if (savedSession) {
      try {
        const session = JSON.parse(savedSession);
        setGameState(session);
      } catch (e) {
        console.error('Failed to restore session:', e);
        localStorage.removeItem(SESSION_KEY);
      }
    }
  }, []);

  const handleJoinGame = (
    gameId: string,
    playerName: string,
    config?: {
      targetPoints: number;
      theme: string;
      aiPlayers: number;
      aiDifficulty: 'easy' | 'medium' | 'hard';
    }
  ) => {
    const playerId = `player-${Math.random().toString(36).substring(2, 9)}`;
    const session = { gameId, playerId, playerName, config };

    // Save to localStorage
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    setGameState(session);
  };

  const handleLeaveGame = () => {
    // Clear localStorage
    localStorage.removeItem(SESSION_KEY);
    setGameState(null);
  };

  if (!gameState) {
    return <Lobby onJoinGame={handleJoinGame} />;
  }

  return (
    <div>
      <button
        onClick={handleLeaveGame}
        style={{
          position: 'fixed',
          top: '10px',
          right: '10px',
          padding: '8px 16px',
          backgroundColor: '#e74c3c',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          zIndex: 1000,
        }}
      >
        Leave Game
      </button>
      <Suspense fallback={
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
            Loading game...
          </div>
        </div>
      }>
        <Game
          gameId={gameState.gameId}
          playerId={gameState.playerId}
          playerName={gameState.playerName}
          config={gameState.config}
        />
      </Suspense>
    </div>
  );
}

export default App;
