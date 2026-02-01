-- Create games table to store game state
CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  state JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE games ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read games
CREATE POLICY "Anyone can read games"
  ON games FOR SELECT
  USING (true);

-- Allow anyone to insert games
CREATE POLICY "Anyone can insert games"
  ON games FOR INSERT
  WITH CHECK (true);

-- Allow anyone to update games
CREATE POLICY "Anyone can update games"
  ON games FOR UPDATE
  USING (true);

-- Enable real-time for the games table
ALTER PUBLICATION supabase_realtime ADD TABLE games;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS games_id_idx ON games(id);
CREATE INDEX IF NOT EXISTS games_updated_at_idx ON games(updated_at);
