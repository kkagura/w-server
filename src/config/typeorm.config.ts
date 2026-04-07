import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import type { DatabaseConfig } from './config.types';

export function createTypeOrmOptions(
  databaseConfig: DatabaseConfig,
): TypeOrmModuleOptions {
  return {
    type: 'mysql',
    host: databaseConfig.host,
    port: databaseConfig.port,
    username: databaseConfig.username,
    password: databaseConfig.password,
    database: databaseConfig.name,
    charset: databaseConfig.charset,
    timezone: databaseConfig.timezone,
    logging: databaseConfig.logging,
    synchronize: databaseConfig.synchronize,
    autoLoadEntities: databaseConfig.autoLoadEntities,
    retryAttempts: databaseConfig.enabled ? 3 : 0,
    retryDelay: 3000,
    manualInitialization: !databaseConfig.enabled,
  };
}
