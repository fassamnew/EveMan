import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { getSystemQueue } from './infra/queue/queue.provider';

@Module({
  imports: [],
  controllers: [HealthController],
  providers: []
})
export class AppModule {
  onModuleInit() {
    // Queue bootstrap for background jobs; workers are added in later phases.
    getSystemQueue();
  }
}
