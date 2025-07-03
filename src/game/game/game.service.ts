import { Socket } from 'socket.io';
import { Server } from 'socket.io';
import { Injectable } from '@nestjs/common';
import { Player, PlayerInput } from './types';

interface Room {
  players: Player[];
  state: any;
  rematchRequests: Set<string>;
}

@Injectable()
export class GameService {
  [x: string]: any;

  private rooms: Map<string, Room> = new Map();
  private server: Server | null = null;

  setServer(server: Server) {
    this.server = server;
  }

  private syncGameState(roomId: string) {
    if (!this.server) return;
    const room = this.rooms.get(roomId);
    if (!room) return;

    console.log(`Syncing game state for room ${roomId}:`, room.state);
    this.server.to(roomId).emit('gameStateUpdate', room.state);
  }

  // Fix the constructor game loop
  constructor() {
    setInterval(() => {
      this.rooms.forEach((room, roomId) => {
        if (room.state.raceStarted) {
          this.updateGameState(roomId);
        }
      });
    }, 16); // 60 FPS
  }

  joinRoom(
    client: Socket,
    roomId: string,
  ): { success: boolean; message?: string } {
    let room = this.rooms.get(roomId);

    if (!room) {
      // Create new room if it doesn't exist
      const newPlayer: Player = {
        id: client.id,
        position: { x: 0, y: 0 },
        velocity: { x: 0, y: 0 },
        rotation: 0,
        input: { up: false, down: false, left: false, right: false },
      };
      room = {
        players: [newPlayer],
        state: this.initializeGameState(),
        rematchRequests: new Set(),
      };
      room.state.players[client.id] = newPlayer;
      this.rooms.set(roomId, room);
      client.join(roomId);

      // Notify players that game can start
      if (room.players.length === 2) {
        this.startGame(roomId);
      }

      return { success: true };
    }

    // If room exists, check if player is already in the room
    if (room.players.some((player) => player.id === client.id)) {
      return { success: false, message: 'Player already in room.' };
    }

    // Add new player to existing room
    const newPlayer: Player = {
      id: client.id,
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
      rotation: 0,
      input: { up: false, down: false, left: false, right: false },
    };
    room.players.push(newPlayer);
    room.state.players[client.id] = newPlayer;
    client.join(roomId);

    // Notify players that game can start
    if (room.players.length === 2) {
      this.startGame(roomId);
    }

    return { success: true };
  }

  handleDisconnect(client: Socket) {
    // Find and clean up any rooms this client was in
    for (const [roomId, room] of this.rooms.entries()) {
      const playerIndex = room.players.findIndex(
        (player) => player.id === client.id,
      );
      if (playerIndex !== -1) {
        // Remove player from room
        room.players.splice(playerIndex, 1);
        delete room.state.players[client.id];

        // Notify remaining players about disconnect
        if (this.server) {
          this.server.to(roomId).emit('playerLeft', {
            players: room.players.map((p) => p.id),
            disconnectedPlayer: client.id,
          });
        }

        // Clean up empty rooms
        if (room.players.length === 0) {
          this.rooms.delete(roomId);
        } else {
          // If there's still one player left, reset the game state
          room.state.raceStarted = false;
          room.state.countdown = 0;
          this.syncGameState(roomId);
        }
      }
    }
  }

  handleRematchRequest(client: Socket, roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.rematchRequests.add(client.id);

    if (room.rematchRequests.size === 2) {
      // Reset game state for rematch
      room.state = this.initializeGameState();
      room.rematchRequests.clear();
      if (this.server) {
        this.server.to(roomId).emit('rematchAccepted');
      }
      this.startGame(roomId);
    }
  }

  private initializeGameState() {
    return {
      players: {},
      raceStarted: false,
      countdown: 0,
      winner: null,
      track: {
        width: 800,
        height: 600,
        checkpoints: [],
      },
    };
  }

  private startGame(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.state.track.checkpoints = this.generateTrackCheckpoints();
    room.state.raceStarted = false;
    room.state.countdown = 3;

    // Start countdown
    const countdownInterval = setInterval(() => {
      if (this.server) {
        this.server.to(roomId).emit('countdownUpdate', room.state.countdown);
      }

      if (room.state.countdown <= 0) {
        clearInterval(countdownInterval);
        room.state.raceStarted = true;
        if (this.server) {
          this.server.to(roomId).emit('raceStart');
        }
      } else {
        room.state.countdown--;
      }
    }, 1000);
  }

  getRoomPlayers(roomId: string): Player[] {
    const room = this.rooms.get(roomId);
    return room ? room.players : [];
  }

  private generateTrackCheckpoints() {
    type Checkpoint = { x: number; y: number; width: number; rotation: number };
    const checkpoints: Checkpoint[] = [];
    const segments = 12;
    const center = { x: 400, y: 300 };
    const radius = 250;

    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      checkpoints.push({
        x: center.x + Math.cos(angle) * radius,
        y: center.y + Math.sin(angle) * radius,
        width: 60,
        rotation: angle + Math.PI / 2,
      });
    }
    return checkpoints;
  }

  // Fix the handlePlayerInput method
  public handlePlayerInput(client: Socket, roomId: string, input: PlayerInput) {
    const room = this.rooms.get(roomId);
    if (!room || !room.state.players[client.id]) return;

    console.log(`Player ${client.id} input:`, input);

    // Update player input
    room.state.players[client.id].input = input;

    // Sync immediately for responsiveness
    this.syncGameState(roomId);
  }

  private updateGameState(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room || !room.state.raceStarted) return;

    // Define track boundaries here since we don't have TRACK_CONFIG
    const TRACK_WIDTH = 800;
    const TRACK_HEIGHT = 600;
    const BOUNDARY_PADDING = 50;

    // Physics constants (tune these as needed)
    const ACCELERATION = 0.2;
    const REVERSE_ACCEL = 0.1;
    const MAX_SPEED = 8;
    const TURN_RATE = 0.1;
    const DRAG = 0.96;

    Object.values(room.state.players).forEach((player: Player) => {
      // Calculate direction vector based on car rotation
      const direction = {
        x: Math.sin(player.rotation),
        y: -Math.cos(player.rotation),
      };

      // Calculate current speed
      const currentSpeed = Math.sqrt(
        player.velocity.x ** 2 + player.velocity.y ** 2,
      );

      // Handle acceleration in facing direction
      if (player.input.up) {
        player.velocity.x += direction.x * ACCELERATION;
        player.velocity.y += direction.y * ACCELERATION;
      }
      // Handle braking/reverse
      else if (player.input.down) {
        player.velocity.x -= direction.x * REVERSE_ACCEL;
        player.velocity.y -= direction.y * REVERSE_ACCEL;
      }

      // Handle steering (only effective when moving)
      if (currentSpeed > 0.1) {
        const turnEffect = TURN_RATE * (currentSpeed / MAX_SPEED);
        if (player.input.left) {
          player.rotation -= turnEffect;
        }
        if (player.input.right) {
          player.rotation += turnEffect;
        }
      }

      // Apply drag/friction
      player.velocity.x *= DRAG;
      player.velocity.y *= DRAG;

      // Limit maximum speed
      if (currentSpeed > MAX_SPEED) {
        const ratio = MAX_SPEED / currentSpeed;
        player.velocity.x *= ratio;
        player.velocity.y *= ratio;
      }

      // Update position
      player.position.x += player.velocity.x;
      player.position.y += player.velocity.y;

      // Keep within track boundaries
      player.position.x = Math.max(
        BOUNDARY_PADDING,
        Math.min(TRACK_WIDTH - BOUNDARY_PADDING, player.position.x),
      );
      player.position.y = Math.max(
        BOUNDARY_PADDING,
        Math.min(TRACK_HEIGHT - BOUNDARY_PADDING, player.position.y),
      );
    });

    // Broadcast updated state
    this.syncGameState(roomId);
  }
}
