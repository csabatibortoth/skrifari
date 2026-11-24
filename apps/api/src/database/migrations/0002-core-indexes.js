// Copyright 2026 Csaba Tóth
// SPDX-License-Identifier: Apache-2.0

/** Indexes of users, languages, sites, domains and the audit log (indexes are created here only, never by Mongoose). */
export async function up(db) {
  await db.collection('users').createIndex({ email: 1 }, { unique: true, name: 'email_unique' });
  await db.collection('languages').createIndex({ tag: 1 }, { unique: true, name: 'tag_unique' });
  await db.collection('sites').createIndex({ slug: 1 }, { unique: true, name: 'slug_unique' });
  await db.collection('domains').createIndex({ hostname: 1 }, { unique: true, name: 'hostname_unique' });
  await db.collection('domains').createIndex({ siteId: 1 }, { name: 'siteId' });
  await db.collection('auditlogs').createIndex({ at: -1 }, { name: 'at_desc' });
  await db.collection('auditlogs').createIndex({ siteId: 1, at: -1 }, { name: 'siteId_at' });
}
