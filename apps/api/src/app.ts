import 'reflect-metadata';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

/** Builds the Nest app; shared by main.ts and the integration tests. */
export async function createApp(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, { logger: process.env.NODE_ENV === 'test' ? ['error'] : ['error', 'warn', 'log'] });
  app.setGlobalPrefix('api');
  // whitelist + forbidNonWhitelisted: unknown or system fields (id, version, …) in a body are a 400.
  // transform: query strings become typed DTOs with their defaults.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

  const openApi = new DocumentBuilder().setTitle('Employee Console API').build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, openApi));

  app.enableShutdownHooks();
  return app;
}
