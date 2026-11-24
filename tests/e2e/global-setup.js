// Copyright 2026 Csaba Tóth
// SPDX-License-Identifier: Apache-2.0
import mongoose from 'mongoose';
import { runMigrations, loadMigrations } from '../../apps/api/src/database/migrate.js';
import { createModels } from '../../apps/api/src/database/models.js';
import { hashPassword } from '../../apps/api/src/security/passwords.js';

export const E2E_EMAIL = 'e2e-admin@example.com';
export const E2E_PASSWORD = 'e2e correct horse battery staple';

/** A throwaway database with the migrations applied and one administrator. */
export default async function globalSetup() {
  const uri = `${process.env.SKRIFARI_TEST_MONGODB_URI ?? 'mongodb://127.0.0.1:27017'}/${process.env.E2E_DATABASE}`;
  const connection = await mongoose.createConnection(uri, { autoIndex: false, autoCreate: false }).asPromise();
  await runMigrations(connection.db, await loadMigrations());
  const { User } = createModels(connection);
  await User.create({
    email: E2E_EMAIL,
    name: 'E2E Admin',
    role: 'admin',
    passwordHash: await hashPassword(E2E_PASSWORD),
  });
  await connection.close();
}
