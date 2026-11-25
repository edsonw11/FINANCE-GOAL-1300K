import { GoneException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CLOCK, type Clock } from '../clock';
import { ACCOUNT_REPOSITORY, type AccountRecord, type AccountRepository } from './account.repository';

export interface AccountDto {
  readonly id: string;
  readonly name: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export const toAccountDto = (a: AccountRecord): AccountDto => ({
  id: a.id,
  name: a.name,
  createdAt: a.createdAt.toISOString(),
  updatedAt: a.updatedAt.toISOString(),
});

@Injectable()
export class AccountsService {
  constructor(
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async list(userId: string): Promise<AccountDto[]> {
    return (await this.accounts.list(userId)).map(toAccountDto);
  }

  async get(userId: string, id: string): Promise<AccountDto> {
    const account = await this.accounts.find(userId, id);
    if (!account) throw new NotFoundException();
    return toAccountDto(account);
  }

  /** Creates or changes (idempotent: the id was chosen by the device). */
  async save(userId: string, id: string, name: string): Promise<AccountDto> {
    const result = await this.accounts.save(userId, id, name, this.clock.now());
    // another person's id and an id that does not exist look the same from outside
    if (result.status === 'taken') throw new NotFoundException();
    if (result.status === 'deleted') throw new GoneException();
    return toAccountDto(result.account);
  }

  /** Always succeeds, whether the record existed, belonged to someone else, or was already deleted: nothing can be learned from it. */
  async remove(userId: string, id: string): Promise<void> {
    await this.accounts.remove(userId, id, this.clock.now());
  }
}
