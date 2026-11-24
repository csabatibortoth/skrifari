// Copyright 2026 Csaba Tóth
// SPDX-License-Identifier: Apache-2.0
import { generateTable } from '/admin/athena/table.js';
import { generateButton } from '/admin/athena/forms.js';
import { showFormDialog, showConfirm } from '/admin/athena/dialog.js';
import { api } from '/admin/api-client.js';
import { block, header, guarded, errorAlert } from '/admin/util.js';

export default async function sites(_context, { app, auth }) {
  const admin = auth.hasRole('admin');
  header(app.wrapper, 'Sites', 'Every site has its own languages and domains.');
  const section = block(app.wrapper, 'All sites');
  let table = null;
  async function load() {
    try {
      const { items } = await api('/sites?limit=100');
      const rows = items.map((s) => ({ ...s, languageList: s.languages.join(', ') }));
      if (table) table.setRows(rows);
      else {
        table = generateTable({
          parent: section,
          id: 'sites',
          caption: 'Sites',
          filter: true,
          density: 'compact',
          columns: [
            { key: 'name', label: 'Name' },
            { key: 'slug', label: 'Slug' },
            { key: 'defaultLanguage', label: 'Default' },
            { key: 'languageList', label: 'Languages' },
          ],
          rows,
          rowActions: admin
            ? [
                { label: 'Domains', onclick: domains },
                { label: 'Delete', danger: true, onclick: remove },
              ]
            : [],
        });
      }
    } catch (error) {
      errorAlert(section, error);
    }
  }
  async function remove(row) {
    if (
      await showConfirm({
        title: 'Delete site',
        message: `Delete the site ${row.name} and its domains?`,
        danger: true,
        typeToConfirm: row.slug,
      })
    ) {
      await guarded(() => api(`/sites/${row.id}`, { method: 'DELETE' }), 'Site deleted');
      await load();
    }
  }
  async function domains(row) {
    const { items } = await api(`/sites/${row.id}/domains`);
    await showFormDialog({
      title: `Domains of ${row.name}`,
      intro: items.length ? `Now: ${items.map((d) => d.hostname).join(', ')}` : 'No domain yet.',
      submitText: 'Add domain',
      fields: [
        { name: 'hostname', label: 'Host name (example.com)', type: 'text', required: true, trim: true },
        { name: 'primary', label: 'Primary', type: 'switch' },
      ],
      onSubmit: (values) => api(`/sites/${row.id}/domains`, { method: 'POST', body: values }),
    });
  }
  if (admin) {
    generateButton({
      parent: section,
      text: 'Add site',
      onclick: () =>
        showFormDialog({
          title: 'Add site',
          fields: [
            { name: 'name', label: 'Name', type: 'text', required: true, trim: true },
            { name: 'slug', label: 'Slug (a-z, 0-9, -)', type: 'text', required: true, trim: true },
            {
              name: 'defaultLanguage',
              label: 'Default language (tag from the registry)',
              type: 'text',
              required: true,
              trim: true,
            },
          ],
          onSubmit: (values) => api('/sites', { method: 'POST', body: values }).then(load),
        }),
    });
  }
  await load();
}
