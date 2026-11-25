import { accountBodySchema } from './account.schemas';
import { RecordSyncResource } from '../legacy/record-sync.resource';
import { type Body, type RecordStore } from '../records/record.store';

/** An account is valid when its name is (the app's account has more fields: archived, demo, ...; they are kept as sent). */
export const accountBodyIsValid = (body: Body): boolean => accountBodySchema.safeParse({ name: body.name }).success;

/** Accounts as seen by the sync: a record of kind `account`, like every other kind, with the account name rules as its check. */
export const accountSyncResource = (store: RecordStore): RecordSyncResource => new RecordSyncResource('account', store, accountBodyIsValid);
