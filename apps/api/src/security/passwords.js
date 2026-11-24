// Copyright 2026 Csaba Tóth
// SPDX-License-Identifier: Apache-2.0
import { argon2, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const argon2Async = promisify(argon2);
// Argon2id, OWASP 2024 minimum profile: 19 MiB, 2 iterations, 1 lane.
const PARAMS = { memory: 19456, passes: 2, parallelism: 1, tagLength: 32 };
export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 256; // bounds the work an attacker can make us do

async function derive(password, nonce, params) {
  return argon2Async('argon2id', { message: Buffer.from(password, 'utf8'), nonce, ...params });
}

/** @returns {Promise<string>} "argon2id$m=..,t=..,p=..$salt$hash" (base64) */
export async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await derive(password, salt, PARAMS);
  return `argon2id$m=${PARAMS.memory},t=${PARAMS.passes},p=${PARAMS.parallelism}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

/** Constant-time check. A malformed stored hash is a failed check, never an exception. */
export async function verifyPassword(password, stored) {
  const match = /^argon2id\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9+/=]+)\$([A-Za-z0-9+/=]+)$/.exec(stored ?? '');
  if (!match || password.length > MAX_PASSWORD_LENGTH) return false;
  const [, memory, passes, parallelism, salt, hash] = match;
  const expected = Buffer.from(hash, 'base64');
  const actual = await derive(password, Buffer.from(salt, 'base64'), {
    memory: Number(memory),
    passes: Number(passes),
    parallelism: Number(parallelism),
    tagLength: expected.length,
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** A hash to compare against when the user does not exist, so that the answer takes the same time. */
let dummy;
export async function verifyAgainstDummy(password) {
  dummy ??= await hashPassword(randomBytes(16).toString('hex'));
  await verifyPassword(password, dummy);
}

/** Policy: length only (no composition rules); the caller shows the reason. @returns {string | null} */
export function checkPasswordPolicy(password) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH)
    return `The password must have at least ${MIN_PASSWORD_LENGTH} characters`;
  if (password.length > MAX_PASSWORD_LENGTH) return `The password must have at most ${MAX_PASSWORD_LENGTH} characters`;
  return null;
}
