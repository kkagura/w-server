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

export interface RedisConfig {
  enabled: boolean;
  host: string;
  port: number;
  username: string;
  password: string;
  db: number;
  keyPrefix: string;
  connectTimeout: number;
}

export interface AuthConfig {
  accessTokenSecret: string;
  accessTokenExpiresIn: number;
  refreshTokenSecret: string;
  refreshTokenExpiresIn: number;
  issuer: string;
  audience: string;
}

export interface MinioConfig {
  enabled: boolean;
  endpoint: string;
  port: number;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
  bucket: string;
}

export interface FileConfig {
  maxSize: number;
  previewMimeTypes: string[];
  allowedMimeTypes: string[];
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
  redis: RedisConfig;
  auth: AuthConfig;
  minio: MinioConfig;
  file: FileConfig;
}
