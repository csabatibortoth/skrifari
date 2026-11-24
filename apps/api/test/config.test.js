// Copyright 2026 Csaba Tóth
// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { loadConfig, describeConfig, ConfigError } from '../src/config/index.js';

const goodSecret = 'k3J9xQ2mVb7LpR4tYw8Zc1NdHs6GfAe0UiOa5XyBnMqT';
const production = {
  NODE_ENV: 'production',
  SKRIFARI_HOST: '0.0.0.0',
  SKRIFARI_MONGODB_URI: 'mongodb://db:27017/s',
  SKRIFARI_REDIS_URL: 'redis://cache:6379',
  SKRIFARI_SESSION_SECRET: goodSecret,
};
const problemsOf = (env) => {
  try {
    loadConfig(env);
    return [];
  } catch (e) {
    expect(e).toBeInstanceOf(ConfigError);
    return e.problems;
  }
};

describe('configuration fails closed', () => {
  it('accepts a complete production configuration', () => {
    const config = loadConfig(production);
    expect(config.production).toBe(true);
    expect(config.port).toBe(3000);
  });
  it('treats an unset NODE_ENV as production', () => {
    expect(problemsOf({}).join()).toMatch(/SKRIFARI_SESSION_SECRET is required/);
  });
  it('refuses an unknown NODE_ENV', () => {
    expect(problemsOf({ ...production, NODE_ENV: 'staging' }).join()).toMatch(/NODE_ENV/);
  });
  it.each([
    '',
    'changeme',
    'short',
    'x'.repeat(40),
    'changeme-changeme-changeme-changeme',
    'abababababababababababababababab',
    'Replace-me-with-a-real-secret-please',
  ])('refuses the production session secret %j', (secret) => {
    expect(problemsOf({ ...production, SKRIFARI_SESSION_SECRET: secret }).join()).toMatch(/SESSION_SECRET/);
  });
  it.each(['SKRIFARI_HOST', 'SKRIFARI_MONGODB_URI', 'SKRIFARI_REDIS_URL'])('requires %s in production', (name) => {
    const env = { ...production };
    delete env[name];
    expect(problemsOf(env).join()).toContain(name);
  });
  it('reports every problem at once and never prints a secret value', () => {
    try {
      loadConfig({ NODE_ENV: 'production', SKRIFARI_SESSION_SECRET: 'changeme', SKRIFARI_PORT: '99999' });
      expect.unreachable();
    } catch (e) {
      expect(e.problems.length).toBeGreaterThan(3);
      expect(e.message).not.toContain('changeme');
    }
  });
  it('validates the port and the URL schemes', () => {
    expect(problemsOf({ ...production, SKRIFARI_PORT: 'abc' }).join()).toMatch(/PORT/);
    expect(problemsOf({ ...production, SKRIFARI_MONGODB_URI: 'http://db' }).join()).toMatch(/MONGODB_URI/);
    expect(problemsOf({ ...production, SKRIFARI_REDIS_URL: 'nonsense' }).join()).toMatch(/REDIS_URL/);
  });
});

describe('development defaults are local only', () => {
  it('binds to loopback and makes a temporary secret', () => {
    const a = loadConfig({ NODE_ENV: 'development' });
    const b = loadConfig({ NODE_ENV: 'development' });
    expect(a.host).toBe('127.0.0.1');
    expect(a.sessionSecret.length).toBeGreaterThanOrEqual(32);
    expect(a.sessionSecret).not.toBe(b.sessionSecret);
  });
});

describe('describeConfig', () => {
  it('hides credentials in URLs and leaves out the session secret', () => {
    const text = JSON.stringify(
      describeConfig(
        loadConfig({
          ...production,
          SKRIFARI_MONGODB_URI: 'mongodb://user:pw123@db/s',
          SKRIFARI_REDIS_URL: 'redis://:pw456@cache:6379',
        }),
      ),
    );
    expect(text).not.toContain('pw123');
    expect(text).not.toContain('pw456');
    expect(text).not.toContain(goodSecret);
  });
});
