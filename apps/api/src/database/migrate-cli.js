// Copyright 2026 Csaba Tóth
// SPDX-License-Identifier: Apache-2.0
import { loadConfig, ConfigError } from '../config/index.js';
import { connectDatabase } from './connect.js';
import { loadMigrations, runMigrations } from './migrate.js';

try {
  const config = loadConfig();
  const connection = await connectDatabase(config.mongodbUri);
  const applied = await runMigrations(connection.db, await loadMigrations());
  console.log(applied.length ? `Applied: ${applied.join(', ')}` : 'Nothing to apply');
  await connection.close();
} catch (error) {
  console.error(error instanceof ConfigError ? error.message : `Migration failed: ${error.message}`);
  process.exitCode = 1;
}
