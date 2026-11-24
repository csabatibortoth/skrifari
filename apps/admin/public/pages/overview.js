// Copyright 2026 Csaba Tóth
// SPDX-License-Identifier: Apache-2.0
import { generateFacts } from '/admin/athena/components.js';
import { api } from '/admin/api-client.js';
import { block, header, errorAlert } from '/admin/util.js';

export default async function overview(_context, { app, auth }) {
  const user = auth.getUser();
  header(app.wrapper, 'Overview', `Signed in as ${user.name} (${user.role}).`);
  const facts = block(app.wrapper, 'Your installation');
  try {
    const [sites, languages] = await Promise.all([api('/sites?limit=100'), api('/languages?limit=100')]);
    generateFacts({
      parent: facts,
      inline: true,
      items: [
        { term: 'Sites', description: String(sites.items.length) },
        { term: 'Languages', description: String(languages.items.length) },
      ],
    });
  } catch (error) {
    errorAlert(facts, error);
  }
}
