export interface Player {
  id: string;
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  rotation: number;
  input: {
    up: boolean;
    left: boolean;
    right: boolean;
    down: boolean;
  };
}

export interface GameState {
  players: Record<string, Player>;
  raceStarted: boolean;
  countdown: number;
  winner: string | null;
  startTime: number | null;
}