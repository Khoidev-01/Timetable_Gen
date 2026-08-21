import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe());

  // An unrestricted CORS policy lets any site a signed-in user visits call this API
  // with their browser's credentials. List the front-ends explicitly instead.
  const origins = (process.env.CORS_ORIGIN ?? '')
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
