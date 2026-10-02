import 'reflect-metadata';
import { createApp } from './bootstrap.js';
import { ConfigError, loadConfig } from './config/app-config.js';
import { loadEnvFile } from './config/env-file.js';
import { AccessPolicyService } from './auth/access-policy.service.js';
import { UsersService } from './auth/users.service.js';
import { JsonLogger } from './common/json-logger.js';

async function main(): Promise<void> {
  loadEnvFile();
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    if (err instanceof ConfigError) {
      process.stderr.write(`${err.message}\n`);
      process.exit(1);
    }
    throw err;
  }
  const logger = new JsonLogger(config.appEnv, config.logLevel);
  const app = await createApp(config, { logger });

  // Keep stored roles in line with the allowlist after a config change (audit trail only).
  const policy = app.get(AccessPolicyService);
  await app
    .get(UsersService)
    .reconcile((email) => policy.roleFor(email))
    .catch(() => logger.write('warn', 'user_reconcile_skipped', { reason: 'database_unavailable' }));

  await app.listen(config.port, config.host);
  logger.write('info', 'api_started', {
    port: config.port,
    host: config.host,
    reportsEnabled: config.reports.enabled,
    commitSha: config.build.commitSha,
  });
}

void main();
