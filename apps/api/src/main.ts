import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { readAppEnv } from '@evemange/config';
import { startTelemetry, stopTelemetry } from './infra/telemetry/telemetry';
import { closeQueueResources } from './infra/queue/queue.provider';

async function bootstrap() {
  const env = readAppEnv();
  startTelemetry();

  const app = await NestFactory.create(AppModule);

  const corsOrigins = env.CORS_ORIGINS
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : true,
    credentials: true
  });

  const port = env.API_PORT;
  await app.listen(port);

  const gracefulShutdown = async () => {
    await app.close();
    await closeQueueResources();
    await stopTelemetry();
    process.exit(0);
  };

  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);

  // eslint-disable-next-line no-console
  console.log(`API running on http://localhost:${port}`);
}

bootstrap();
