import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import { AppModule } from '../src/app.module';

const server = express();
let isInitialized = false;

async function bootstrap() {
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server));
  app.setGlobalPrefix('api');
  app.enableCors({ origin: true, credentials: true });
  await app.init();
  isInitialized = true;
}

export default async function handler(req: any, res: any) {
  if (!isInitialized) {
    await bootstrap();
  }
  server(req, res);
}
