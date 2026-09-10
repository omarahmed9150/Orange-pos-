import type { Request, Response } from 'express';
import { createApp } from '../src/bootstrap';

let handlerPromise: Promise<(req: Request, res: Response) => void>;

export default async function handler(req: Request, res: Response) {
  handlerPromise ??= createApp().then((app) => {
    return app.init().then(() => {
    const expressApp = app.getHttpAdapter().getInstance() as (
      request: Request,
      response: Response,
    ) => void;
    return expressApp;
    });
  });

  const expressApp = await handlerPromise;
  return expressApp(req, res);
}
