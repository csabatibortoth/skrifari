// Copyright 2026 Csaba Tóth
// SPDX-License-Identifier: Apache-2.0
import { randomBytes } from 'node:crypto';

/** Values that are known placeholders: never accepted as a secret outside development. */
const KNOWN_WEAK = new Set([
  'changeme',
  'change-me',
  'change_me',
  'secret',
  'password',
  'default',
  'example',
  'test',
  'dev',
  'development',
  'your-secret-here',
  'replace-me',
  'replace_me',
  'insert-secret-here',
  'skrifari',
  'session-secret',
]);
const MIN_SECRET_LENGTH = 32;
const ENVIRONMENTS = new Set(['development', 'test', 'production']);

/** Thrown at startup when the configuration is not safe to run with. The message names variables, never values. */
export class ConfigError extends Error {
  /** @param {string[]} problems */
  constructor(problems) {
    super(`Invalid configuration:\n - ${problems.join('\n - ')}`);
    this.name = 'ConfigError';
    this.problems = problems;
  }
}

/** True when a secret looks like a placeholder or is too weak to use outside development. */
function isWeakSecret(value) {
  const lower = value.trim().toLowerCase();
  if (KNOWN_WEAK.has(lower) || /^(x+|0+|1+|a+|\*+)$/.test(lower)) return true;
  if (/^(changeme|change-me|replace|your[-_ ]|example|placeholder|todo)/.test(lower)) return true;
  return new Set(value).size < 8; // "abababab..." and the like
}

function parsePort(raw, problems) {
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    problems.push('SKRIFARI_PORT must be an integer from 1 to 65535');
    return 0;
  }
  return port;
}

function parseUrl(name, raw, protocols, problems) {
  try {
    const url = new URL(raw);
    if (!protocols.includes(url.protocol)) problems.push(`${name} must use one of: ${protocols.join(' ')}`);
  } catch {
    problems.push(`${name} is not a valid URL`);
  }
}

/**
 * Reads and validates the configuration. Fails closed: outside development a missing, default or weak secret is an error,
 * and an unknown NODE_ENV is an error (it is never treated as development).
 * @param {Record<string, string | undefined>} [env]
 * @returns {Readonly<{env: string, production: boolean, host: string, port: number, mongodbUri: string, redisUrl: string, sessionSecret: string}>}
 */
export function loadConfig(env = process.env) {
  const problems = [];
  const nodeEnv = env.NODE_ENV ?? 'production'; // unset means production: the safe default
  if (!ENVIRONMENTS.has(nodeEnv)) problems.push('NODE_ENV must be development, test or production');
  const production = nodeEnv !== 'development' && nodeEnv !== 'test';
  const development = nodeEnv === 'development';

  const host = env.SKRIFARI_HOST || (development || nodeEnv === 'test' ? '127.0.0.1' : '');
  if (!host)
    problems.push(
      'SKRIFARI_HOST is required in production (use 0.0.0.0 only behind a reverse proxy or in a container)',
    );
  const port = parsePort(env.SKRIFARI_PORT ?? '3000', problems);

  const mongodbUri = env.SKRIFARI_MONGODB_URI || (production ? '' : 'mongodb://127.0.0.1:27017/skrifari');
  if (!mongodbUri) problems.push('SKRIFARI_MONGODB_URI is required in production');
  else parseUrl('SKRIFARI_MONGODB_URI', mongodbUri, ['mongodb:', 'mongodb+srv:'], problems);

  const redisUrl = env.SKRIFARI_REDIS_URL || (production ? '' : 'redis://127.0.0.1:6379');
  if (!redisUrl) problems.push('SKRIFARI_REDIS_URL is required in production');
  else parseUrl('SKRIFARI_REDIS_URL', redisUrl, ['redis:', 'rediss:'], problems);

  let sessionSecret = env.SKRIFARI_SESSION_SECRET ?? '';
  if (production) {
    if (!sessionSecret) problems.push('SKRIFARI_SESSION_SECRET is required in production');
    else if (sessionSecret.length < MIN_SECRET_LENGTH)
      problems.push(`SKRIFARI_SESSION_SECRET must be at least ${MIN_SECRET_LENGTH} characters`);
    else if (isWeakSecret(sessionSecret)) problems.push('SKRIFARI_SESSION_SECRET is a known placeholder or too weak');
  } else if (!sessionSecret) {
    sessionSecret = randomBytes(48).toString('base64'); // temporary: sessions do not survive a restart in development
  }

  if (problems.length > 0) throw new ConfigError(problems);
  return Object.freeze({ env: nodeEnv, production, host, port, mongodbUri, redisUrl, sessionSecret });
}

/** The configuration without secrets, for logs. */
export function describeConfig(config) {
  const hide = (value) => value.replace(/\/\/[^@/]*@/, '//***@');
  return {
    env: config.env,
    host: config.host,
    port: config.port,
    mongodbUri: hide(config.mongodbUri),
    redisUrl: hide(config.redisUrl),
  };
}
