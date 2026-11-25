import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { type SessionRecord, type SessionRepository } from './session.repository';

@Injectable()
export class PrismaSessionRepository implements SessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async insert(record: SessionRecord): Promise<void> {
    await this.prisma.session.create({ data: { ...record } });
  }

  async find(idHash: string): Promise<SessionRecord | null> {
    return this.prisma.session.findUnique({ where: { idHash } });
  }

  async touch(idHash: string, at: Date): Promise<void> {
    // updateMany: a session removed meanwhile is not an error
    await this.prisma.session.updateMany({ where: { idHash }, data: { lastSeenAt: at } });
  }

  async delete(idHash: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { idHash } });
  }

  async deleteAllForUser(userId: string): Promise<number> {
    return (await this.prisma.session.deleteMany({ where: { userId } })).count;
  }

  async deleteExpired(before: Date): Promise<number> {
    return (await this.prisma.session.deleteMany({ where: { expiresAt: { lte: before } } })).count;
  }
}
