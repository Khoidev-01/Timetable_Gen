import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe());

  // CORS: whitelist from CORS_ORIGINS (comma-separated). When unset, fall back
  // to allow-all so local dev keeps working. Set it in production.
  const corsOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  if (corsOrigins.length > 0) {
    app.enableCors({ origin: corsOrigins, credentials: true });
  } else {
    app.enableCors();
  }

  await app.listen(process.env.PORT ?? 4000);
}
bootstrap();
