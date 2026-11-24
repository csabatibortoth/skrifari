// Copyright 2026 Csaba Tóth
// SPDX-License-Identifier: Apache-2.0
import { header } from '/admin/util.js';

export default async function notfound(_context, { app }) {
  header(app.wrapper, 'Page not found', 'There is nothing at this address.');
}
