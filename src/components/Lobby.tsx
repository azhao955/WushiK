import { useState } from 'react';

interface LobbyProps {
  onJoinGame: (gameId: string, playerName: string) => void;
}

export function Lobby({ onJoinGame }: LobbyProps) {
  const [playerName, setPlayerName] = useState('');
  const [gameId, setGameId] = useState('');

  const handleCreateGame = () => {
    if (!playerName.trim()) {
      alert('Please enter your name!');
      return;
    }

    const newGameId = Math.random().toString(36).substring(2, 8).toUpperCase();
    onJoinGame(newGameId, playerName);
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
        backgroundColor: '#2c3e50',
        color: 'white',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <div
        style={{
          backgroundColor: '#34495e',
          padding: '40px',
          borderRadius: '12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          maxWidth: '400px',
          width: '100%',
        }}
      >
        <h1 style={{ textAlign: 'center', marginBottom: '30px', fontSize: '36px' }}>
          🎴 WuShiK
        </h1>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            Your Name:
          </label>
          <input
            type="text"
            value={playerName}
            onChange={e => setPlayerName(e.target.value)}
            placeholder="Enter your name"
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '16px',
              borderRadius: '4px',
              border: '2px solid #7f8c8d',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ marginBottom: '30px' }}>
          <button
            onClick={handleCreateGame}
            style={{
              width: '100%',
              padding: '14px',
              fontSize: '18px',
              fontWeight: 'bold',
              backgroundColor: '#27ae60',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
            }}
            onMouseOver={e => (e.currentTarget.style.backgroundColor = '#229954')}
            onMouseOut={e => (e.currentTarget.style.backgroundColor = '#27ae60')}
          >
            Create New Game
          </button>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '20px', color: '#bdc3c7' }}>
          - OR -
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            Game ID:
          </label>
          <input
            type="text"
            value={gameId}
            onChange={e => setGameId(e.target.value)}
            placeholder="Enter game ID"
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '16px',
              borderRadius: '4px',
              border: '2px solid #7f8c8d',
              boxSizing: 'border-box',
              textTransform: 'uppercase',
            }}
          />
        </div>

        <button
          onClick={handleJoinGame}
          style={{
            width: '100%',
            padding: '14px',
            fontSize: '18px',
            fontWeight: 'bold',
            backgroundColor: '#3498db',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            transition: 'background-color 0.2s',
          }}
          onMouseOver={e => (e.currentTarget.style.backgroundColor = '#2980b9')}
          onMouseOut={e => (e.currentTarget.style.backgroundColor = '#3498db')}
        >
          Join Existing Game
        </button>

        <div
          style={{
            marginTop: '30px',
            padding: '15px',
            backgroundColor: '#2c3e50',
            borderRadius: '4px',
            fontSize: '14px',
          }}
        >
          <strong>How to play:</strong>
          <ul style={{ marginTop: '10px', paddingLeft: '20px' }}>
            <li>3+ players</li>
            <li>Collect 5s, 10s, and Kings for points</li>
            <li>First to target points wins!</li>
            <li>Player with 3♠ starts</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
