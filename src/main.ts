import { NestFactory } from '@nestjs/core';
import { GameModule } from './game/game.module';

async function bootstrap() {
  const app = await NestFactory.create(GameModule);
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
