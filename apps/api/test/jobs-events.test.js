// Copyright 2026 Csaba Tóth
// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { createEventBus } from '../src/events/index.js';
import { createJobs } from '../src/jobs/index.js';

describe('event bus', () => {
  it('runs the handlers in order and isolates a failing handler', async () => {
    const seen = [];
    const errors = [];
    const bus = createEventBus({ onError: (e, name) => errors.push([e.message, name]) });
    bus.on('x', () => seen.push(1));
    bus.on('x', () => {
      throw new Error('bad handler');
    });
    const off = bus.on('x', () => seen.push(3));
    await bus.emit('x', {});
    off();
    await bus.emit('x', {});
    expect(seen).toEqual([1, 3, 1]);
    expect(errors).toEqual([
      ['bad handler', 'x'],
      ['bad handler', 'x'],
    ]);
  });
  it('an event nobody listens to is fine', async () => {
    await createEventBus().emit('nothing', 1);
  });
});

describe('jobs (BullMQ)', () => {
  it('processes a job through a real queue and worker, then closes cleanly', async () => {
    const jobs = createJobs(process.env.SKRIFARI_TEST_REDIS_URL ?? 'redis://127.0.0.1:6379');
    const name = `test-${process.pid}-${Date.now()}`;
    try {
      const done = new Promise((resolve) => jobs.process(name, async (job) => resolve(job.data.n * 2)));
      await jobs.queue(name).add('double', { n: 21 });
      expect(await done).toBe(42);
    } finally {
      await jobs.queue(name).obliterate({ force: true });
      await jobs.close();
    }
  });
});
