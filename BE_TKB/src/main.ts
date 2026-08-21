// Must come first: every module below may read process.env while being evaluated.
import './load-env';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

import { ValidationPipe } from '@nestjs/common';
import { PrismaExceptionFilter } from './prisma/prisma-exception.filter';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // transform: ép kiểu theo DTO · whitelist: bỏ thuộc tính lạ ·
  // forbidNonWhitelisted: trả 400 nếu request mang thuộc tính không khai báo
  app.useGlobalPipes(
    new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
  );

  // Đưa lỗi Prisma về đúng mã HTTP thay vì để lộ 500 chung chung
  app.useGlobalFilters(new PrismaExceptionFilter());

  // An unrestricted CORS policy lets any site a signed-in user visits call this API
  // with their browser's credentials. List the front-ends explicitly instead.
  // Deploy sets CORS_ORIGIN; CORS_ORIGINS is accepted too so neither name is missed.
  const origins = `${process.env.CORS_ORIGINS ?? ''},${process.env.CORS_ORIGIN ?? ''}`
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  app.enableCors({
    origin: origins.length > 0 ? origins : ['http://localhost:3000'],
    credentials: true,
  });

  // Interactive API reference. Every route except login, captcha and the health check
  // needs a bearer token, so the Authorize button is the only way to try them here.
  const swaggerConfig = new DocumentBuilder()
    .setTitle('API Xếp Thời khóa biểu THPT')
    .setDescription(
      'Hệ thống xếp thời khóa biểu tự động theo chương trình GDPT 2018. ' +
        'Mọi endpoint đều yêu cầu JWT trừ những endpoint gắn nhãn công khai.',
    )
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  await app.listen(process.env.PORT ?? 4000);
}
bootstrap();
