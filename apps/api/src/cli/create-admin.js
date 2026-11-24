// Copyright 2026 Csaba Tóth
// SPDX-License-Identifier: Apache-2.0
// Creates the first administrator: node src/cli/create-admin.js <email> <name>   (the password is read from stdin, never from an argument or the environment)
//   printf '%s' "$PASSWORD" | npm run create-admin -w @skrifari/api -- admin@example.com "Admin"
import { loadConfig, ConfigError } from '../config/index.js';
import { connectDatabase } from '../database/connect.js';
import { createModels } from '../database/models.js';
import { hashPassword, checkPasswordPolicy } from '../security/passwords.js';

const [email, ...nameParts] = process.argv.slice(2);
const name = nameParts.join(' ') || 'Administrator';
let connection;
try {
  if (!email || !/^[^@\s]+@[^@\s]+$/.test(email))
    throw new Error('Usage: create-admin <email> [name]   (password on stdin)');
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const password = Buffer.concat(chunks)
    .toString('utf8')
    .replace(/\r?\n$/, '');
  const problem = checkPasswordPolicy(password);
  if (problem) throw new Error(problem);
  const config = loadConfig();
  connection = await connectDatabase(config.mongodbUri);
  const { User } = createModels(connection);
  await User.create({ email, name, role: 'admin', passwordHash: await hashPassword(password) });
  console.log(`Administrator ${email.toLowerCase()} created`);
} catch (error) {
  console.error(
    error instanceof ConfigError
      ? error.message
      : error.code === 11000
        ? 'A user with this e-mail exists'
        : error.message,
  );
  process.exitCode = 1;
} finally {
  await connection?.close();
}
