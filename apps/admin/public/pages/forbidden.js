// Copyright 2026 Csaba Tóth
// SPDX-License-Identifier: Apache-2.0
import { header } from '/admin/util.js';

export default async function forbidden(_context, { app }) {
  header(app.wrapper, 'Not allowed', 'Your role does not allow this page.');
}
