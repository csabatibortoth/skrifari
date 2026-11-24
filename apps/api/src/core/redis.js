// Copyright 2026 Csaba Tóth
// SPDX-License-Identifier: Apache-2.0
import { Redis } from 'ioredis';

/**
 * Creates the Redis client (cache and sessions). It does not connect until first use, and a lost connection
 * never crashes the process: readiness reports it.
 * @param {string} url
 */
export function createRedis(url) {
  const redis = new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: 2,
    enableOfflineQueue: false,
    retryStrategy: (n) => Math.min(n * 200, 2000),
  });
  redis.on('error', () => {}); // errors surface through ping() in the readiness check, not as unhandled events
  return redis;
}
