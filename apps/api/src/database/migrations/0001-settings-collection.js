// Copyright 2026 Csaba Tóth
// SPDX-License-Identifier: Apache-2.0

/** Baseline: the settings collection with a unique key. Migrations must be idempotent. */
export async function up(db) {
  const existing = await db.listCollections({ name: 'settings' }).toArray();
  if (existing.length === 0) await db.createCollection('settings');
  await db.collection('settings').createIndex({ key: 1 }, { unique: true, name: 'key_unique' });
}
