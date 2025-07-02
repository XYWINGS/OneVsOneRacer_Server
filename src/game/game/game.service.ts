import { Injectable } from '@nestjs/common';
import { Socket } from 'socket.io';
import { Player, PlayerInput } from './types';
import { Server } from 'socket.io';

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

  // Update all methods that use this.server to check for null
  private syncGameState(roomId: string) {
    if (!this.server) return;
    const room = this.rooms.get(roomId);
    if (!room) return;
    this.server.to(roomId).emit('gameStateUpdate', room.state);
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
      const index = room.players.findIndex((player) => player.id === client.id);
      if (index !== -1) {
        room.players.splice(index, 1);
        // Notify remaining player about disconnect
        if (room.players.length > 0) {
          client.to(roomId).emit('playerDisconnected');
        }
        // Clean up empty rooms
        if (room.players.length === 0) {
          this.rooms.delete(roomId);
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
    };
  }

  private startGame(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

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

  private updateGameState(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    // Update car positions based on physics
    Object.values(room.state.players).forEach((player: Player) => {
      // Simple physics
      if (player.input.up) player.velocity.y -= 0.5;
      if (player.input.down) player.velocity.y += 0.5;
      if (player.input.left) player.velocity.x -= 0.5;
      if (player.input.right) player.velocity.x += 0.5;

      // Apply friction
      player.velocity.x *= 0.9;
      player.velocity.y *= 0.9;

      // Update position
      player.position.x += player.velocity.x;
      player.position.y += player.velocity.y;
    });

    // Broadcast updated state
    if (this.server) {
      this.server.to(roomId).emit('gameStateUpdate', room.state);
    }
  }

  private updatePlayerPosition(player: Player, input: PlayerInput) {
    // Apply acceleration
    if (input.up) player.velocity.y -= 0.2;
    if (input.down) player.velocity.y += 0.2;
    if (input.left) {
      player.velocity.x -= 0.2;
      player.rotation -= 0.05;
    }
    if (input.right) {
      player.velocity.x += 0.2;
      player.rotation += 0.05;
    }

    // Apply friction
    player.velocity.x *= 0.96;
    player.velocity.y *= 0.96;

    // Update position
    player.position.x += player.velocity.x;
    player.position.y += player.velocity.y;

    // Keep within track bounds (simplified)
    player.position.x = Math.max(50, Math.min(750, player.position.x));
    player.position.y = Math.max(50, Math.min(550, player.position.y));
  }

  public handlePlayerInput(client: Socket, roomId: string, input: PlayerInput) {
    const room = this.rooms.get(roomId);
    if (!room || !room.state.players[client.id]) return;

    room.state.players[client.id].input = input;
    this.updatePlayerPosition(room.state.players[client.id], input);
    this.syncGameState(roomId);
  }
  // Call this in a game loop (e.g., every 16ms)
  constructor() {
    setInterval(() => {
      this.rooms.forEach((_, roomId) => this.updateGameState(roomId));
    }, 16);
  }
}
