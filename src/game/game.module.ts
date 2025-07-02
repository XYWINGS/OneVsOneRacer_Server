import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { GameGateway } from './game/game.gateway';
import { GameService } from './game/game.service';
import { LoggerMiddleware } from 'src/logger/logger.middleware';

@Module({
  providers: [GameGateway, GameService],
})
export class GameModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
