import { createApp } from './bootstrap';

async function bootstrap() {
  const app = await createApp();
  const port = process.env.PORT ?? 3000;
  const host = process.env.HOST ?? '0.0.0.0';
  await app.listen(port, host);
  console.log(`Application running on http://${host}:${port}`);
}

bootstrap();

