import { Module } from '@nestjs/common';
import { GameGateway } from './game/game.gateway';
import { GameService } from './game/game.service';

@Module({
  providers: [GameGateway, GameService],
})
export class GameModule {}
