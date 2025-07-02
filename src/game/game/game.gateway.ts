import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GameService } from './game.service';

@WebSocketGateway({
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  constructor(private readonly gameService: GameService) {}

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
    this.gameService.handleDisconnect(client);
  }

  @SubscribeMessage('playerInput')
  handlePlayerInput(client: Socket, payload: { roomId: string; input: any }) {
    this.gameService.handlePlayerInput(client, payload.roomId, payload.input);
  }

  @SubscribeMessage('requestRematch')
  handleRematchRequest(client: Socket, roomId: string) {
    this.gameService.handleRematchRequest(client, roomId);
  }

  @SubscribeMessage('joinRoom')
  async handleJoinRoom(client: Socket, payload: { roomId: string }) {
    const result = await this.gameService.joinRoom(client, payload.roomId);

    if (result.success) {
      // Notify all players in the room
      this.server.to(payload.roomId).emit('playerJoined', {
        playerId: client.id,
        players: this.gameService.getRoomPlayers(payload.roomId),
      });
    }

    return result;
  }
}
