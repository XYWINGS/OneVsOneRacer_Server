import { Injectable } from '@nestjs/common';
import { Socket } from 'socket.io';

interface Room {
  players: string[];
  state: any; // You'll define proper game state interface later
  rematchRequests: Set<string>;
}

@Injectable()
export class GameService {
  private rooms: Map<string, Room> = new Map();
  server: any;

  joinRoom(
    client: Socket,
    roomId: string,
  ): { success: boolean; message?: string } {
    let room = this.rooms.get(roomId);

    if (!room) {
      // Create new room if it doesn't exist
      room = {
        players: [client.id],
        state: this.initializeGameState(),
        rematchRequests: new Set(),
      };
      this.rooms.set(roomId, room);
      client.join(roomId);
      return { success: true };
    }

    if (room.players.length >= 2) {
      return { success: false, message: 'Room is full' };
    }

    // Add player to existing room
    room.players.push(client.id);
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
      const index = room.players.indexOf(client.id);
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

  handlePlayerInput(client: Socket, roomId: string, input: any) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    client.to(roomId).emit('gameStateUpdate', room.state);
  }

  handleRematchRequest(client: Socket, roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.rematchRequests.add(client.id);

    if (room.rematchRequests.size === 2) {
      // Reset game state for rematch
      room.state = this.initializeGameState();
      room.rematchRequests.clear();
      this.server.to(roomId).emit('rematchAccepted');
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
      this.server.to(roomId).emit('countdownUpdate', room.state.countdown);

      if (room.state.countdown <= 0) {
        clearInterval(countdownInterval);
        room.state.raceStarted = true;
        this.server.to(roomId).emit('raceStart');
      } else {
        room.state.countdown--;
      }
    }, 1000);
  }
}
