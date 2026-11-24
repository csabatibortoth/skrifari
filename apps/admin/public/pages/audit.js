// Copyright 2026 Csaba Tóth
// SPDX-License-Identifier: Apache-2.0
import { generateTable } from '/admin/athena/table.js';
import { api } from '/admin/api-client.js';
import { block, header, errorAlert } from '/admin/util.js';

export default async function audit(_context, { app }) {
  header(app.wrapper, 'Audit log', 'The newest 100 entries: who did what.');
  const section = block(app.wrapper, 'Entries');
  try {
    const { items } = await api('/audit?limit=100');
    generateTable({
      parent: section,
      id: 'audit',
      caption: 'Audit log',
      filter: true,
      density: 'compact',
      stack: true,
      columns: [
        { key: 'at', label: 'When', render: (row, value) => new Date(value).toLocaleString() },
        { key: 'action', label: 'Action' },
        { key: 'targetType', label: 'Target' },
        { key: 'ip', label: 'IP' },
      ],
      rows: items,
    });
  } catch (error) {
    errorAlert(section, error);
  }
}
