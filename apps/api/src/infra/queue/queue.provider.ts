import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';

let redisConnection: IORedis | null = null;
let systemQueue: Queue | null = null;
let systemWorker: Worker | null = null;

function getRedisConnection(): IORedis {
  if (redisConnection) {
    return redisConnection;
  }

  redisConnection = new IORedis({
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT || 6379),
    maxRetriesPerRequest: null
  });

  return redisConnection;
}

export function getSystemQueue(): Queue {
  if (systemQueue) {
    return systemQueue;
  }

  systemQueue = new Queue('system', {
    connection: getRedisConnection()
  });

  return systemQueue;
}

export function startSystemWorker(): Worker {
  if (systemWorker) {
    return systemWorker;
  }

  systemWorker = new Worker(
    'system',
    async job => {
      if (job.name === 'registration.confirmation-email') {
        const payload = job.data as {
          registrantId: string;
          referenceCode: string;
          email: string;
          fullName: string;
          eventName: string;
          linkTitle: string;
        };

        // Phase 3 worker baseline: in Phase 5 this is replaced with real email delivery.
        console.log(
          `confirmation-email queued for ${payload.email} (${payload.referenceCode}) on ${payload.eventName}`
        );
      }
    },
    {
      connection: getRedisConnection()
    }
  );

  return systemWorker;
}

export async function closeQueueResources(): Promise<void> {
  if (systemWorker) {
    await systemWorker.close();
    systemWorker = null;
  }

  if (systemQueue) {
    await systemQueue.close();
    systemQueue = null;
  }

  if (redisConnection) {
    await redisConnection.quit();
    redisConnection = null;
  }
}
