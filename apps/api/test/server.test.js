// Copyright 2026 Csaba Tóth
// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { buildServer } from '../src/server.js';
import { loadConfig } from '../src/config/index.js';

const config = loadConfig({ NODE_ENV: 'test' });
const up = { ping: async () => 'PONG' };
const mongoUp = { db: { admin: () => ({ ping: async () => ({ ok: 1 }) }) } };
const down = {
  ping: async () => {
    throw new Error('connect ECONNREFUSED 10.1.2.3:6379');
  },
};

describe('health and readiness', () => {
  it('/health answers without any dependency', async () => {
    const app = buildServer({ config });
    const res = await app.inject('/health');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['cache-control']).toBe('no-store');
  });
  it('/ready is 200 when both dependencies answer', async () => {
    const res = await buildServer({ config, mongo: mongoUp, redis: up }).inject('/ready');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok', mongo: 'ok', redis: 'ok' });
  });
  it('/ready is 503 and names the dependency, not the reason', async () => {
    const res = await buildServer({ config, mongo: mongoUp, redis: down }).inject('/ready');
    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ status: 'unavailable', mongo: 'ok', redis: 'down' });
    expect(res.body).not.toMatch(/ECONNREFUSED|10\.1\.2\.3/);
  });
  it('/ready is 503 when nothing is connected', async () => {
    expect((await buildServer({ config }).inject('/ready')).statusCode).toBe(503);
  });
  it('serves the OpenAPI document', async () => {
    const doc = (await buildServer({ config }).inject('/openapi.json')).json();
    expect(doc.openapi).toMatch(/^3\./);
    expect(Object.keys(doc.paths)).toEqual(expect.arrayContaining(['/health', '/ready']));
  });
  it('does not leak error details of a failing request', async () => {
    const app = buildServer({ config });
    app.get('/boom', async () => {
      throw new Error('secret internal detail');
    });
    const res = await app.inject('/boom');
    expect(res.statusCode).toBe(500);
    expect(res.body).not.toContain('secret internal detail');
  });
});
