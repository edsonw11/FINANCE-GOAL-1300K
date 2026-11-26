import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { type AuditEntry, type AuditRepository } from './audit.repository';

@Injectable()
export class PrismaAuditRepository implements AuditRepository {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry, now: Date): Promise<void> {
    await this.prisma.auditLog.create({
      data: { actorUserId: entry.actorUserId, action: entry.action, target: entry.target, details: entry.details as object, createdAt: now },
    });
  }
}
