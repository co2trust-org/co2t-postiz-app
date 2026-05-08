import { initializeSentry } from '@gitroom/nestjs-libraries/sentry/initialize.sentry';
initializeSentry('backend', true);
import compression from 'compression';

import { loadSwagger } from '@gitroom/helpers/swagger/load.swagger';
import { json } from 'express';
import { Runtime } from '@temporalio/worker';
Runtime.install({ shutdownSignals: [] });

process.env.TZ = 'UTC';

import cookieParser from 'cookie-parser';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

import { SubscriptionExceptionFilter } from '@gitroom/backend/services/auth/permissions/subscription.exception';
import { HttpExceptionFilter } from '@gitroom/nestjs-libraries/services/exception.filter';
import { ConfigurationChecker } from '@gitroom/helpers/configuration/configuration.checker';
import { startMcp } from '@gitroom/nestjs-libraries/chat/start.mcp';

async function start() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    cors: {
      ...(!process.env.NOT_SECURED ? { credentials: true } : {}),
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'x-copilotkit-runtime-client-gql-version',
      ],
      exposedHeaders: [
        'reload',
        'onboarding',
        'activate',
        'x-copilotkit-runtime-client-gql-version',
        ...(process.env.NOT_SECURED ? ['auth', 'showorg', 'impersonate'] : []),
      ],
      origin: [
        process.env.FRONTEND_URL,
        'http://localhost:6274',
        ...(process.env.MAIN_URL ? [process.env.MAIN_URL] : []),
      ],
    },
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
    })
  );

  app.use(['/copilot/*', '/posts'], (req: any, res: any, next: any) => {
    json({ limit: '50mb' })(req, res, next);
  });

  app.use(cookieParser());
  app.use(compression());
  app.useGlobalFilters(new SubscriptionExceptionFilter());
  app.useGlobalFilters(new HttpExceptionFilter());

  loadSwagger(app);

  // In the Docker+nginx image, Nginx binds the public $PORT; the API must use a fixed loopback
  // port (see Dockerfile ENV BACK_END_PORT and var/docker/start.sh). Do not fall back to $PORT
  // here, or the API may bind the same port as Nginx or a port nginx is not proxying to.
  // For a backend-only process on Railway, set BACK_END_PORT to that service’s PORT in env.
  const rawPort = process.env.BACK_END_PORT || '3000';
  const port = Number(rawPort);
  const listenPort = Number.isFinite(port) && port > 0 ? port : 3000;
  const listenHost = '0.0.0.0';

  try {
    await app.listen(listenPort, listenHost);
    Logger.log(
      `Backend listening on http://${listenHost}:${listenPort} (nginx upstream expects this port)`
    );

    checkConfiguration();

    // MCP ties into Mastra (agents, tools) and must not block HTTP readiness: nginx proxies to
    // this port immediately; a slow or failing MCP bootstrap was causing connection refused.
    if (process.env.DISABLE_MCP === 'true') {
      Logger.warn('MCP bootstrap disabled via DISABLE_MCP');
    } else {
      void startMcp(app).catch((err) => {
        Logger.error(
          'MCP bootstrap failed (API continues without MCP routes)',
          err instanceof Error ? err.stack : err
        );
      });
    }
  } catch (e) {
    Logger.error(`Backend failed to start on port ${listenPort}`, e);
    throw e;
  }
}

function checkConfiguration() {
  const checker = new ConfigurationChecker();
  checker.readEnvFromProcess();
  checker.check();

  if (checker.hasIssues()) {
    for (const issue of checker.getIssues()) {
      Logger.warn(issue, 'Configuration issue');
    }

    Logger.warn('Configuration issues found: ' + checker.getIssuesCount());
  } else {
    Logger.log('Configuration check completed without any issues');
  }
}

start().catch((e) => {
  Logger.error('Backend fatal startup error', e);
  process.exitCode = 1;
});
