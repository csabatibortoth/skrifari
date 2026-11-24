// Copyright 2026 Csaba Tóth
// SPDX-License-Identifier: Apache-2.0
import mongoose from 'mongoose';

export default async function globalTeardown() {
  const uri = `${process.env.SKRIFARI_TEST_MONGODB_URI ?? 'mongodb://127.0.0.1:27017'}/${process.env.E2E_DATABASE}`;
  const connection = await mongoose.createConnection(uri).asPromise();
  await connection.dropDatabase();
  await connection.close();
}
