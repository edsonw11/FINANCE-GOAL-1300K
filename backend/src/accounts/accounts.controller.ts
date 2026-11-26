import { Body, Controller, Delete, Get, HttpCode, Param, Put } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { type AuthenticatedSession } from '../auth/session.service';
import { parseInput } from '../http/parse-input';
import { accountBodySchema, accountIdSchema } from './account.schemas';
import { type AccountDto, AccountsService } from './accounts.service';

/** Not marked @Public(): the global guard requires a login. Every call is scoped to the logged-in person. */
@Controller('api/v1/accounts')
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Get()
  async list(@CurrentUser() auth: AuthenticatedSession): Promise<{ items: AccountDto[] }> {
    return { items: await this.accounts.list(auth.userId) };
  }

  @Get(':id')
  get(@CurrentUser() auth: AuthenticatedSession, @Param('id') id: string): Promise<AccountDto> {
    return this.accounts.get(auth.userId, parseInput(accountIdSchema, id));
  }

  @Put(':id')
  @HttpCode(200)
  save(@CurrentUser() auth: AuthenticatedSession, @Param('id') id: string, @Body() body: unknown): Promise<AccountDto> {
    return this.accounts.save(auth.userId, parseInput(accountIdSchema, id), parseInput(accountBodySchema, body).name);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() auth: AuthenticatedSession, @Param('id') id: string): Promise<void> {
    await this.accounts.remove(auth.userId, parseInput(accountIdSchema, id));
  }
}
