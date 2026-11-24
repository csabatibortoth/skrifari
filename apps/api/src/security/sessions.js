// Copyright 2026 Csaba Tóth
// SPDX-License-Identifier: Apache-2.0
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const IDLE_SECONDS = 60 * 60; // a session unused for an hour ends
const ABSOLUTE_SECONDS = 12 * 60 * 60; // and no session lives longer than 12 hours
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

/** The cookie name. "__Host-" makes the browser enforce: Secure, Path=/, no Domain. */
export const cookieName = (config) => (config.production ? '__Host-skrifari_sid' : 'skrifari_sid');

/** The options of the session cookie: HttpOnly, SameSite=Strict, Secure in production. */
export const cookieOptions = (config) => ({
  httpOnly: true,
  sameSite: 'strict',
  secure: config.production,
  path: '/',
  maxAge: ABSOLUTE_SECONDS,
});

/**
 * Server-side sessions in Redis. The browser holds only a random id; Redis keys use its SHA-256, so a leaked Redis dump
 * contains no usable session id. Nothing about a session is ever put in browser storage or in a log.
 * @param {import('ioredis').Redis} redis
 */
export function createSessionStore(redis) {
  const key = (id) => `skrifari:sess:${sha256(id)}`;
  const userKey = (userId) => `skrifari:user-sessions:${userId}`;
  return {
    /** Always a NEW id: call it at login and whenever the privileges of the user change (rotation). */
    async create(userId, role) {
      const id = randomBytes(32).toString('base64url');
      const session = {
        userId: String(userId),
        role,
        csrf: randomBytes(32).toString('base64url'),
        createdAt: Date.now(),
      };
      await redis
        .multi()
        .set(key(id), JSON.stringify(session), 'EX', IDLE_SECONDS)
        .sadd(userKey(userId), sha256(id))
        .expire(userKey(userId), ABSOLUTE_SECONDS)
        .exec();
      return { id, session };
    },
    /** @returns {Promise<{userId: string, role: string, csrf: string, createdAt: number} | null>} */
    async get(id) {
      if (typeof id !== 'string' || id.length < 40 || id.length > 100) return null;
      const raw = await redis.get(key(id));
      if (!raw) return null;
      const session = JSON.parse(raw);
      if (Date.now() - session.createdAt > ABSOLUTE_SECONDS * 1000) {
        await this.destroy(id);
        return null;
      }
      await redis.expire(key(id), IDLE_SECONDS); // sliding idle timeout
      return session;
    },
    async destroy(id) {
      const raw = await redis.get(key(id));
      if (raw) await redis.srem(userKey(JSON.parse(raw).userId), sha256(id));
      await redis.del(key(id));
    },
    /** Revocation: ends every session of a user (password change, deactivation, role change). */
    async destroyAllOfUser(userId) {
      const hashes = await redis.smembers(userKey(userId));
      if (hashes.length > 0) await redis.del(...hashes.map((h) => `skrifari:sess:${h}`));
      await redis.del(userKey(userId));
    },
  };
}

/** Constant-time comparison of two strings. */
export function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}
