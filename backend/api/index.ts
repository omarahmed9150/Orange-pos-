import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';

const server = express();
let appInstance: any;

async function getApp() {
  if (!appInstance) {
    appInstance = await NestFactory.create(AppModule, new ExpressAdapter(server));
    appInstance.setGlobalPrefix('api');
    appInstance.enableCors({ origin: true, credentials: true });
    await appInstance.init();
  }
  return appInstance;
}

export default async function handler(req: any, res: any) {
  try {
    await getApp();
    server(req, res);
  } catch (err: any) {
    console.error('Serverless Bootstrap Error:', err);
    res.status(500).json({
      statusCode: 500,
      message: 'Serverless Bootstrap Failed',
      error: err?.message || String(err),
    });
  }
}
