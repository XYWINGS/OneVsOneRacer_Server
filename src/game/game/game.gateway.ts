import { WebSocketGateway, WebSocketServer, SubscribeMessage, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
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

  @SubscribeMessage('joinRoom')
  handleJoinRoom(client: Socket, roomId: string) {
    return this.gameService.joinRoom(client, roomId);
  }

  @SubscribeMessage('playerInput')
  handlePlayerInput(client: Socket, payload: { roomId: string; input: any }) {
    this.gameService.handlePlayerInput(client, payload.roomId, payload.input);
  }

  @SubscribeMessage('requestRematch')
  handleRematchRequest(client: Socket, roomId: string) {
    this.gameService.handleRematchRequest(client, roomId);
  }
}