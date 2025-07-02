import { NestFactory } from '@nestjs/core';
import { GameModule } from './game/game.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const port = process.env.PORT ?? 3000;

  const app = await NestFactory.create(GameModule);

  await app.listen(port);
  logger.log(`Game server is running on http://localhost:${port}`);
}
bootstrap();
