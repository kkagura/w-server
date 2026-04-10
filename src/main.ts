import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import type { AppConfig } from './config/config.types';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  const configService = app.get(ConfigService<AppConfig>);
  const serverConfig = configService.getOrThrow('server', { infer: true });

  await app.listen(serverConfig.port, serverConfig.host);
}
bootstrap();
