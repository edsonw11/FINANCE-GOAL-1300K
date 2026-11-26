import { Module } from '@nestjs/common';
import { ClockModule } from '../clock.module';
import { AddressRateLimitGuard, PersonRateLimitGuard } from './rate-limit.guard';
import { RateLimiter } from './rate-limiter';

@Module({
  imports: [ClockModule],
  providers: [RateLimiter, AddressRateLimitGuard, PersonRateLimitGuard],
  exports: [RateLimiter, AddressRateLimitGuard, PersonRateLimitGuard],
})
export class SecurityModule {}
