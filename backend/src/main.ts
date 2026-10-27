import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3001);
  const corsOrigin = configService.get<string>('CORS_ORIGIN', 'http://localhost:8080');
  const bodyLimit = configService.get<string>('REQUEST_BODY_LIMIT', '2mb');

  // Preserve raw body for Meta X-Hub-Signature-256 verification on RE ingest.
  app.use(
    json({
      limit: bodyLimit,
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );
  app.use(urlencoded({ extended: true, limit: bodyLimit }));

  app.enableCors({
    origin: [corsOrigin, 'http://localhost:8080', 'http://localhost:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'authorization',
      'content-type',
      'x-api-key',
      'x-client-info',
      'apikey',
      'x-hub-signature-256',
      'x-re-ingest-key',
    ],
  });

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  app.enableShutdownHooks();

  await app.listen(port);
  console.log(`NestJS API running on http://localhost:${port}/api`);
}

bootstrap();
