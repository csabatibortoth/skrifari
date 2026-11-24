// Copyright 2026 Csaba Tóth
// SPDX-License-Identifier: Apache-2.0
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { loadMigrations, runMigrations } from '../src/database/migrate.js';

// Needs a MongoDB: SKRIFARI_TEST_MONGODB_URI (default: the local one). A throwaway database per run.
const uri = process.env.SKRIFARI_TEST_MONGODB_URI ?? 'mongodb://127.0.0.1:27017';
let connection;
let db;
beforeAll(async () => {
  connection = await mongoose.createConnection(uri, { serverSelectionTimeoutMS: 3000 }).asPromise();
  db = connection.useDb(`skrifari_test_${process.pid}_${Date.now()}`).db;
});
afterAll(async () => {
  await db?.dropDatabase();
  await connection?.close();
});

describe('migrations', () => {
  it('applies each migration once, in order, and is idempotent', async () => {
    const migrations = await loadMigrations();
    expect(migrations.map((m) => m.id)).toEqual([...migrations.map((m) => m.id)].sort());
    const first = await runMigrations(db, migrations);
    expect(first).toEqual(migrations.map((m) => m.id));
    expect(await runMigrations(db, migrations)).toEqual([]);
    const indexes = await db.collection('settings').indexes();
    expect(indexes.some((i) => i.name === 'key_unique' && i.unique)).toBe(true);
    expect(await db.collection('_migrations').countDocuments({ _id: 'lock' })).toBe(0);
  });
  it('refuses a second runner while the lock is held and releases it after a failure', async () => {
    await db.collection('_migrations').insertOne({ _id: 'lock', expiresAt: new Date(Date.now() + 60000) });
    await expect(runMigrations(db, [])).rejects.toThrow(/in progress/);
    await db.collection('_migrations').deleteOne({ _id: 'lock' });
    await expect(
      runMigrations(db, [
        {
          id: '9999-bad',
          up: async () => {
            throw new Error('boom');
          },
        },
      ]),
    ).rejects.toThrow('boom');
    expect(await db.collection('_migrations').countDocuments({ _id: 'lock' })).toBe(0);
    expect(await db.collection('_migrations').countDocuments({ _id: '9999-bad' })).toBe(0);
  });
  it('takes over an expired lock', async () => {
    await db.collection('_migrations').insertOne({ _id: 'lock', expiresAt: new Date(Date.now() - 1000) });
    await expect(runMigrations(db, [])).resolves.toEqual([]);
  });
});
