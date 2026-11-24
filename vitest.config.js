// Copyright 2026 Csaba Tóth
// SPDX-License-Identifier: Apache-2.0
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['apps/**/test/**/*.test.js', 'packages/**/test/**/*.test.js'], testTimeout: 15000 },
});
