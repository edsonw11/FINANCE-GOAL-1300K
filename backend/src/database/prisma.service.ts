import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { APP_CONFIG, type AppConfig } from '../config/app-config';
import { PrismaClient } from '../generated/prisma/client';

const CONNECT_TIMEOUT_MS = 5_000;
const POOL_SIZE = 10;

/**
 * The one Prisma client of the API (shared pool). It connects on first use, not at startup, so the API can boot while
 * the database is still coming up and /health/ready reports it meanwhile.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(@Inject(APP_CONFIG) config: Pick<AppConfig, 'databaseUrl'>) {
    super({
      adapter: new PrismaPg({
        connectionString: config.databaseUrl,
        connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
        max: POOL_SIZE,
      }),
    });
  }

  /** Rejects when the database cannot answer a trivial query. */
  async ping(): Promise<void> {
    await this.$queryRaw`SELECT 1`;
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
