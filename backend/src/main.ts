import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import type { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // A 5 MiB attachment expands to about 7 MiB when encoded as Base64 JSON.
  app.useBodyParser('json', { limit: '8mb' });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port', 3000);
  const apiPrefix = configService.get<string>('apiPrefix', '/api/v1');
  const cleanPrefix = apiPrefix.replace(/^\/+/, '');

  // 1. Cho phép Frontend React gọi API không bị lỗi CORS
  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // 2. Thiết lập tiền tố toàn cục /api/v1
  app.setGlobalPrefix(cleanPrefix);

  // 3. Tự động kiểm tra dữ liệu đầu vào
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // 4. Thiết lập Swagger OpenAPI (/api/docs)
  const swaggerConfig = new DocumentBuilder()
    .setTitle('HelpDesk+ Omnichannel AI API')
    .setDescription('Hệ thống điều phối hỗ trợ khách hàng đa kênh tích hợp AI.')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'HelpDesk+ API Documentation',
  });

  await app.listen(port);

  logger.log(`🚀 Server chạy tại:      http://localhost:${port}/${cleanPrefix}`);
  logger.log(`📑 Swagger UI tại:       http://localhost:${port}/api/docs`);
  logger.log(`🩺 Health check tại:     http://localhost:${port}/${cleanPrefix}/health`);
}

void bootstrap();
