// Copyright 2026 Csaba Tóth
// SPDX-License-Identifier: Apache-2.0
import { Queue, Worker } from 'bullmq';

export const QUEUE_SYSTEM = 'system';

/** BullMQ wants its own connection options (no retry limit for blocking commands). */
function connectionOptions(redisUrl) {
  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    db: url.pathname.length > 1 ? Number(url.pathname.slice(1)) : 0,
    tls: url.protocol === 'rediss:' ? {} : undefined,
    maxRetriesPerRequest: null,
  };
}

/**
 * The job queues and their workers. Modules register processors here later (media, search, scheduled publication).
 * @param {string} redisUrl
 * @param {{ log?: { error: Function } }} [options]
 */
export function createJobs(redisUrl, { log } = {}) {
  const connection = connectionOptions(redisUrl);
  const queues = new Map();
  const workers = [];
  const queue = (name) => {
    if (!queues.has(name))
      queues.set(
        name,
        new Queue(name, {
          connection,
          defaultJobOptions: {
            removeOnComplete: 100,
            removeOnFail: 500,
            attempts: 3,
            backoff: { type: 'exponential', delay: 1000 },
          },
        }),
      );
    return queues.get(name);
  };
  return {
    queue,
    /** Registers a processor for a queue and starts a worker. */
    process(name, processor, { concurrency = 2 } = {}) {
      const worker = new Worker(name, processor, { connection, concurrency });
      worker.on('error', (error) => log?.error({ err: error }, 'worker error'));
      workers.push(worker);
      return worker;
    },
    async close() {
      await Promise.all(workers.map((w) => w.close()));
      await Promise.all([...queues.values()].map((q) => q.close()));
    },
  };
}
