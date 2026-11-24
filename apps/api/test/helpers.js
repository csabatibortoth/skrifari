// Copyright 2026 Csaba Tóth
// SPDX-License-Identifier: Apache-2.0
import mongoose from 'mongoose';
import { createRedis } from '../src/core/redis.js';
import { loadConfig } from '../src/config/index.js';
import { buildServer } from '../src/server.js';
import { loadMigrations, runMigrations } from '../src/database/migrate.js';
import { createModels } from '../src/database/models.js';
import { hashPassword } from '../src/security/passwords.js';

const mongoUri = process.env.SKRIFARI_TEST_MONGODB_URI ?? 'mongodb://127.0.0.1:27017';
const redisUrl = process.env.SKRIFARI_TEST_REDIS_URL ?? 'redis://127.0.0.1:6379';
export const PASSWORD = 'correct horse battery staple';

/** A full application on a throwaway database and a throwaway Redis key space, plus a small cookie-aware client. */
export async function startApp({ production = false } = {}) {
  const connection = await mongoose
    .createConnection(mongoUri, {
      serverSelectionTimeoutMS: 3000,
      autoIndex: false,
      autoCreate: false,
      sanitizeFilter: true,
    })
    .asPromise();
  const dbName = `skrifari_test_${process.pid}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const mongo = connection.useDb(dbName, { useCache: false });
  await runMigrations(mongo.db, await loadMigrations());
  const redis = createRedis(redisUrl);
  await redis.connect();
  const env = production
    ? {
        NODE_ENV: 'production',
        SKRIFARI_HOST: '127.0.0.1',
        SKRIFARI_MONGODB_URI: mongoUri,
        SKRIFARI_REDIS_URL: redisUrl,
        SKRIFARI_SESSION_SECRET: 'k3J9xQ2mVb7LpR4tYw8Zc1NdHs6GfAe0UiOa5XyBnMqT',
      }
    : { NODE_ENV: 'test' };
  const config = loadConfig(env);
  const app = buildServer({ config, mongo, redis });
  await app.ready();
  const models = createModels(mongo);

  const makeUser = async (role = 'admin', email = `${role}-${Math.random().toString(36).slice(2)}@example.com`) =>
    models.User.create({ email, name: `Test ${role}`, role, passwordHash: await hashPassword(PASSWORD) });

  /** A client with its own cookie jar and CSRF token. */
  const client = () => {
    let cookie = '';
    let csrf = '';
    const call = async (method, url, body, headers = {}) => {
      const res = await app.inject({
        method,
        url,
        payload: body,
        headers: {
          ...(cookie ? { cookie } : {}),
          ...(csrf && method !== 'GET' ? { 'x-csrf-token': csrf } : {}),
          ...headers,
        },
      });
      const set = res.headers['set-cookie'];
      if (set) cookie = String(Array.isArray(set) ? set[0] : set).split(';')[0];
      return res;
    };
    return {
      call,
      get: (u, h) => call('GET', u, undefined, h),
      post: (u, b, h) => call('POST', u, b, h),
      patch: (u, b, h) => call('PATCH', u, b, h),
      del: (u, h) => call('DELETE', u, undefined, h),
      get cookie() {
        return cookie;
      },
      set cookie(v) {
        cookie = v;
      },
      get csrf() {
        return csrf;
      },
      set csrf(v) {
        csrf = v;
      },
      async login(user, password = PASSWORD) {
        const res = await call('POST', '/api/v1/auth/login', { email: user.email, password });
        if (res.statusCode === 200) csrf = res.json().csrfToken;
        return res;
      },
    };
  };

  return {
    app,
    models,
    redis,
    config,
    makeUser,
    client,
    async stop() {
      await app.close();
      await mongo.db.dropDatabase();
      await redis.quit();
      await connection.close();
    },
  };
}
