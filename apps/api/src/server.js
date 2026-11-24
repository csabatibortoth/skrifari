// Copyright 2026 Csaba Tóth
// SPDX-License-Identifier: Apache-2.0
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import { loadConfig, describeConfig, ConfigError } from './config/index.js';
import { connectDatabase } from './database/connect.js';
import { createRedis } from './core/redis.js';
import { buildOpenApiDocument } from './core/openapi.js';

const VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
const CHECK_TIMEOUT_MS = 2000;

const withTimeout = (promise) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), CHECK_TIMEOUT_MS).unref()),
  ]);

/**
 * Builds the Fastify application. Dependencies are passed in, so tests can use stubs.
 * @param {{ config: ReturnType<typeof import('./config/index.js').loadConfig>, mongo?: { db: { admin(): { ping(): Promise<unknown> } } }, redis?: { ping(): Promise<string> } }} options
 */
export function buildServer({ config, mongo, redis }) {
  const app = Fastify({
    logger: {
      level: config.env === 'test' ? 'silent' : 'info',
      redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
    },
    bodyLimit: 1024 * 1024,
    trustProxy: false, // forwarded headers are never trusted until a proxy allow-list exists (M2)
  });
  const openapi = buildOpenApiDocument(VERSION);

  app.addHook('onSend', async (_request, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Cache-Control', 'no-store');
  });

  app.get('/health', async () => ({ status: 'ok' }));

  app.get('/ready', async (_request, reply) => {
    const checks = await Promise.allSettled([
      mongo ? withTimeout(mongo.db.admin().ping()) : Promise.reject(new Error('no database')),
      redis ? withTimeout(redis.ping()) : Promise.reject(new Error('no redis')),
    ]);
    const [mongoCheck, redisCheck] = checks;
    const ok = checks.every((c) => c.status === 'fulfilled');
    // The answer says which dependency is down, never why (no addresses, no error text).
    return reply.code(ok ? 200 : 503).send({
      status: ok ? 'ok' : 'unavailable',
      mongo: mongoCheck.status === 'fulfilled' ? 'ok' : 'down',
      redis: redisCheck.status === 'fulfilled' ? 'ok' : 'down',
    });
  });

  app.get('/openapi.json', async () => openapi);

  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error }, 'request failed');
    const code = error.statusCode && error.statusCode < 500 ? error.statusCode : 500;
    reply.code(code).send({ error: code === 500 ? 'Internal Server Error' : error.message });
  });

  return app;
}

/** Starts everything and shuts down gracefully on SIGINT / SIGTERM. */
export async function start() {
  let config;
  try {
    config = loadConfig();
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(error.message);
      process.exit(1);
    }
    throw error;
  }
  const mongo = await connectDatabase(config.mongodbUri);
  const redis = createRedis(config.redisUrl);
  await redis.connect();
  const app = buildServer({ config, mongo, redis });
  app.log.info({ config: describeConfig(config) }, 'starting');

  let closing = false;
  const shutdown = async (signal) => {
    if (closing) return;
    closing = true;
    app.log.info({ signal }, 'shutting down');
    const force = setTimeout(() => process.exit(1), 10000);
    force.unref();
    try {
      await app.close();
      await redis.quit().catch(() => redis.disconnect()); // a lost connection must not block the shutdown
      await mongo.close();
      process.exit(0);
    } catch (error) {
      app.log.error({ err: error }, 'shutdown failed');
      process.exit(1);
    }
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await app.listen({ host: config.host, port: config.port });
  return app;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await start();
