import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { type MutationLog, type MutationOutcome } from './mutation-log';

@Injectable()
export class PrismaMutationLog implements MutationLog {
  constructor(private readonly prisma: PrismaService) {}

  async find(userId: string, mutationId: string): Promise<MutationOutcome | null> {
    const row = await this.prisma.syncMutation.findUnique({ where: { userId_mutationId: { userId, mutationId } } });
    return row ? (row.outcome as unknown as MutationOutcome) : null;
  }

  async record(userId: string, mutationId: string, outcome: MutationOutcome, now: Date): Promise<void> {
    const json = JSON.stringify(outcome);
    await this.prisma.$queryRaw`
      INSERT INTO sync_mutation (user_id, mutation_id, outcome, created_at)
      VALUES (${userId}::uuid, ${mutationId}::uuid, ${json}::jsonb, ${now})
      ON CONFLICT (user_id, mutation_id) DO NOTHING`;
  }
}
