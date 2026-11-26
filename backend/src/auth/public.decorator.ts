import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'everfox:isPublic';

/**
 * Opts a route out of authentication. Everything else requires a login: the guard is global and denies by default,
 * so a route someone forgets to mark is protected, not open.
 */
export const Public = () => SetMetadata(IS_PUBLIC, true);
