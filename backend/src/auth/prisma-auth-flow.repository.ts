import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { type AuthFlowRecord, type AuthFlowRepository } from './auth-flow.repository';

interface AuthFlowRow {
  id_hash: string;
  state: string;
  nonce: string;
  code_verifier: string;
  return_to: string;
  created_at: Date;
  expires_at: Date;
}

@Injectable()
export class PrismaAuthFlowRepository implements AuthFlowRepository {
  constructor(private readonly prisma: PrismaService) {}

  async insert(record: AuthFlowRecord): Promise<void> {
    await this.prisma.authFlow.create({ data: { ...record } });
  }

  async consume(idHash: string): Promise<AuthFlowRecord | null> {
    // one statement: of two requests with the same value, the database lets only one get the row
    const rows = await this.prisma.$queryRaw<AuthFlowRow[]>`
      DELETE FROM auth_flow WHERE id_hash = ${idHash}
      RETURNING id_hash, state, nonce, code_verifier, return_to, created_at, expires_at`;
    const row = rows[0];
    if (!row) return null;
    return {
      idHash: row.id_hash,
      state: row.state,
      nonce: row.nonce,
      codeVerifier: row.code_verifier,
      returnTo: row.return_to,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    };
  }

  async deleteExpired(before: Date): Promise<number> {
    return (await this.prisma.authFlow.deleteMany({ where: { expiresAt: { lte: before } } })).count;
  }
}
