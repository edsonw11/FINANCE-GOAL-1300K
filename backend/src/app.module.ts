import { type DynamicModule, Module } from '@nestjs/common';
import { type AppConfig } from './config/app-config';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';

@Module({})
export class AppModule {
  /** The configuration is an argument (not read from process.env here), so tests build the app with their own. */
  static forRoot(config: AppConfig): DynamicModule {
    return { module: AppModule, imports: [ConfigModule.forRoot(config), DatabaseModule, HealthModule] };
  }
}
