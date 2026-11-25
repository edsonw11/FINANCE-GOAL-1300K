import { Global, Module } from '@nestjs/common';
import { CLOCK, systemClock } from './clock';

/** The time for everyone. A test replaces it (overrideProvider(CLOCK)) to move forward without waiting. */
@Global()
@Module({
  providers: [{ provide: CLOCK, useValue: systemClock }],
  exports: [CLOCK],
})
export class ClockModule {}
