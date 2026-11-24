// Copyright 2026 Csaba Tóth
// SPDX-License-Identifier: Apache-2.0
import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'migrations');
const LOCK_ID = 'lock';
const LOCK_TTL_MS = 10 * 60 * 1000;

/**
 * @typedef {{ id: string, up: (db: import('mongodb').Db) => Promise<void> }} Migration
 */

/** Loads the migrations of a folder, sorted by file name (0001-name.js, 0002-name.js ...). Ids must be unique. */
export async function loadMigrations(dir = MIGRATIONS_DIR) {
  const files = (await readdir(dir)).filter((f) => /^\d{4}-[a-z0-9-]+\.js$/.test(f)).sort();
  /** @type {Migration[]} */
  const migrations = [];
  for (const file of files) {
    const module = await import(join(dir, file));
    if (typeof module.up !== 'function') throw new Error(`Migration ${file} has no up(db) function`);
    migrations.push({ id: file.replace(/\.js$/, ''), up: module.up });
  }
  return migrations;
}

/** Takes the migration lock (one runner at a time); an expired lock of a crashed runner is taken over. */
async function acquireLock(control) {
  const now = new Date();
  try {
    await control.updateOne(
      { _id: LOCK_ID, $or: [{ expiresAt: { $lt: now } }, { expiresAt: { $exists: false } }] },
      { $set: { expiresAt: new Date(now.getTime() + LOCK_TTL_MS) } },
      { upsert: true },
    );
    return true;
  } catch (error) {
    if (error.code === 11000) return false; // the lock exists and has not expired
    throw error;
  }
}

/**
 * Applies every migration that has not been applied. Idempotent and safe for two runners at once.
 * @param {import('mongodb').Db} db
 * @param {Migration[]} migrations
 * @returns {Promise<string[]>} the ids applied now
 */
export async function runMigrations(db, migrations) {
  const control = db.collection('_migrations');
  if (!(await acquireLock(control))) throw new Error('Another migration run is in progress');
  const applied = [];
  try {
    const done = new Set((await control.find({ _id: { $ne: LOCK_ID } }).toArray()).map((d) => d._id));
    for (const migration of migrations) {
      if (done.has(migration.id)) continue;
      await migration.up(db);
      await control.insertOne({ _id: migration.id, appliedAt: new Date() });
      applied.push(migration.id);
    }
  } finally {
    await control.deleteOne({ _id: LOCK_ID });
  }
  return applied;
}
