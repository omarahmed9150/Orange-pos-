import 'reflect-metadata';
import path from 'path';

let cachedServer: any;

async function bootstrapServer() {
  if (!cachedServer) {
    const { NestFactory } = await import('@nestjs/core');
    const { ExpressAdapter } = await import('@nestjs/platform-express');
    const express = (await import('express')).default;

    const distPath1 = path.join(process.cwd(), 'backend', 'dist', 'src', 'app.module');
    const distPath2 = path.join(process.cwd(), 'backend', 'dist', 'app.module');
    const distPath3 = path.resolve(__dirname, '../dist/src/app.module');
    const distPath4 = path.resolve(__dirname, '../dist/app.module');

    let appModule;
    try {
      appModule = (await import(distPath1)).AppModule;
    } catch {
      try {
        appModule = (await import(distPath2)).AppModule;
      } catch {
        try {
          appModule = (await import(distPath3)).AppModule;
        } catch {
          appModule = (await import(distPath4)).AppModule;
        }
      }
    }

    const server = express();
    const app = await NestFactory.create(appModule, new ExpressAdapter(server), {
      logger: ['error', 'warn'],
    });

    app.setGlobalPrefix('api');
    app.enableCors({ origin: true, credentials: true });
    await app.init();

    cachedServer = server;
  }
  return cachedServer;
}

export default async function handler(req: any, res: any) {
  try {
    const server = await bootstrapServer();
    return server(req, res);
  } catch (err: any) {
    console.error('VERCEL_BOOTSTRAP_CRASH:', err);
    return res.status(500).json({
      statusCode: 500,
      error: 'Server Initialization Failed',
      message: err?.message || String(err),
      stack: err?.stack,
    });
  }
}
