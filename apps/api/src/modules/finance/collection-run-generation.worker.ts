import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { FinanceService } from './finance.service.js';

@Injectable()
export class CollectionRunGenerationWorker implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private ticking = false;
  constructor(private readonly finance: FinanceService) {}
  onModuleInit() {
    if (process.env.NODE_ENV === 'test' && process.env.COLLECTION_RUN_GENERATION_WORKER !== 'true') return;
    this.timer = setInterval(() => void this.tick(), 500);
    void this.tick();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }
  async tick() {
    if (this.ticking) return;
    this.ticking = true;
    try { while (await this.finance.processNextGeneration()) { /* drain durable queued work */ } }
    finally { this.ticking = false; }
  }
}
