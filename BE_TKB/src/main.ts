import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

import { ValidationPipe } from '@nestjs/common';
import { PrismaExceptionFilter } from './prisma/prisma-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // - transform: coerce payloads to their declared types (e.g. numeric strings).
  // - whitelist: strip properties not declared in the DTO.
  // - forbidNonWhitelisted: reject (400) requests carrying unknown properties.
  // Routes whose @Body is still an untyped object are not affected (the pipe
  // only validates/strips bodies typed with a DTO class that has validators).
  app.useGlobalPipes(
    new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
  );

  // Map Prisma errors (missing record, unique/FK violations) to correct HTTP
  // codes instead of leaking a generic 500.
  app.useGlobalFilters(new PrismaExceptionFilter());

  // CORS: whitelist from CORS_ORIGINS or CORS_ORIGIN (comma-separated). The
  // production deploy sets the singular CORS_ORIGIN, so accept both names to
  // avoid silently falling back to allow-all. When unset, allow-all keeps local
  // dev working.
  const corsOrigins = `${process.env.CORS_ORIGINS || ''},${process.env.CORS_ORIGIN || ''}`
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
