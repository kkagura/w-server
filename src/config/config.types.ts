export interface DatabaseConfig {
  enabled: boolean;
  host: string;
  port: number;
  username: string;
  password: string;
  name: string;
  charset: string;
  timezone: string;
  logging: boolean;
  synchronize: boolean;
  autoLoadEntities: boolean;
}

export interface AppConfig {
  app: {
    env: string;
    name: string;
  };
  server: {
    host: string;
    port: number;
  };
  database: DatabaseConfig;
}
