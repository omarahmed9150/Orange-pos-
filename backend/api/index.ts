import 'reflect-metadata';

let cachedServer: any;

async function bootstrapServer() {
  if (!cachedServer) {
    const { NestFactory } = await import('@nestjs/core');
    const { ExpressAdapter } = await import('@nestjs/platform-express');
    const express = (await import('express')).default;

    let appModule;
    try {
      appModule = (await import('../dist/src/app.module')).AppModule;
    } catch (e) {
      appModule = (await import('../dist/app.module')).AppModule;
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
