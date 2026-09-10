import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';

const server = express();
let isReady = false;

async function bootstrap() {
  if (!isReady) {
    const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
      logger: ['error', 'warn'],
    });
    app.setGlobalPrefix('api');
    app.enableCors({ origin: true, credentials: true });
    await app.init();
    isReady = true;
  }
}

export default async function handler(req: any, res: any) {
  try {
    await bootstrap();
    server(req, res);
  } catch (err: any) {
    console.error('Vercel Handler Error:', err);
    res.status(500).json({
      statusCode: 500,
      error: 'Initialization Error',
      message: err?.message || String(err),
    });
  }
}
