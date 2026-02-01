import { useState } from 'react';
import { Lobby } from './components/Lobby';
import { Game } from './components/Game';

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
    setGameState({ gameId, playerId, playerName, config });
  };

  const handleLeaveGame = () => {
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
      <Game
        gameId={gameState.gameId}
        playerId={gameState.playerId}
        playerName={gameState.playerName}
        config={gameState.config}
      />
    </div>
  );
}

export default App;
