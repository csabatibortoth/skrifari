// Copyright 2026 Csaba Tóth
// SPDX-License-Identifier: Apache-2.0
import mongoose from 'mongoose';

/**
 * Connects Mongoose to MongoDB. Indexes are managed by migrations only: autoIndex and autoCreate are off.
 * @param {string} uri
 * @returns {Promise<import('mongoose').Connection>}
 */
export async function connectDatabase(uri) {
  const connection = mongoose.createConnection(uri, {
    autoIndex: false,
    autoCreate: false,
    serverSelectionTimeoutMS: 5000,
    sanitizeFilter: true,
  });
  await connection.asPromise();
  return connection;
}
