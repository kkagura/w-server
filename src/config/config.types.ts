export interface AppConfig {
  app: {
    env: string;
    name: string;
  };
  server: {
    host: string;
    port: number;
  };
}
