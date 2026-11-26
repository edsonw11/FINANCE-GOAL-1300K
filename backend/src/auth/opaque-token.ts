import { createHash, randomBytes } from 'node:crypto';

const TOKEN_BYTES = 32;
/** 32 bytes in base64url: always 43 characters. */
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;

/** A random value for the browser to hold (a session, a login attempt): 256 bits, unguessable. */
export const newOpaqueToken = (): string => randomBytes(TOKEN_BYTES).toString('base64url');

/** What the database stores instead of the token: a copy of the table cannot be used to log in. */
export const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

/** Cheap check before touching the database: anything that is not shaped like our tokens cannot be one. */
export const looksLikeToken = (value: unknown): value is string => typeof value === 'string' && TOKEN_SHAPE.test(value);
