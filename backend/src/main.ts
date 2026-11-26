import { Logger } from '@nestjs/common';
import { ConfigError } from './config/config-error';
import { loadConfig } from './config/load-config';
import { redactUrl } from './config/redact';
import { createApp } from './create-app';
import { registerGracefulShutdown } from './shutdown';

async function bootstrap(): Promise<void> {
  let config;
  try {
    config = loadConfig(process.env);
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(error.message);
      process.exit(1);
    }
    throw error;
  }
  const app = await createApp(config);
  const logger = new Logger('Bootstrap');
  registerGracefulShutdown(app, { log: (message) => logger.log(message) });
  await app.listen(config.port, config.host);
  logger.log(`Listening on ${config.host}:${config.port} (${config.nodeEnv}); database ${redactUrl(config.databaseUrl)}`);
}

void bootstrap();
