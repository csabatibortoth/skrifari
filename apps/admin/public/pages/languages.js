// Copyright 2026 Csaba Tóth
// SPDX-License-Identifier: Apache-2.0
import { generateTable } from '/admin/athena/table.js';
import { generateButton } from '/admin/athena/forms.js';
import { showFormDialog, showConfirm } from '/admin/athena/dialog.js';
import { api } from '/admin/api-client.js';
import { block, header, guarded, errorAlert } from '/admin/util.js';

export default async function languages(_context, { app, auth }) {
  const admin = auth.hasRole('admin');
  header(app.wrapper, 'Languages', 'The registry: every language a site can use (BCP 47 tag, direction).');
  const section = block(app.wrapper, 'Registry');
  let table = null;
  async function load() {
    try {
      const { items } = await api('/languages?limit=100');
      if (table) table.setRows(items);
      else {
        table = generateTable({
          parent: section,
          id: 'languages',
          caption: 'Languages',
          filter: true,
          density: 'compact',
          columns: [
            { key: 'tag', label: 'Tag' },
            { key: 'name', label: 'Name' },
            { key: 'direction', label: 'Direction' },
          ],
          rows: items,
          rowActions: admin ? [{ label: 'Delete', danger: true, onclick: remove }] : [],
        });
      }
    } catch (error) {
      errorAlert(section, error);
    }
  }
  async function remove(row) {
    if (await showConfirm({ title: 'Delete language', message: `Delete ${row.name} (${row.tag})?`, danger: true })) {
      await guarded(() => api(`/languages/${row.id}`, { method: 'DELETE' }), 'Language deleted');
      await load();
    }
  }
  if (admin) {
    generateButton({
      parent: section,
      text: 'Add language',
      onclick: () =>
        showFormDialog({
          title: 'Add language',
          fields: [
            { name: 'tag', label: 'BCP 47 tag (en, hu, pt-BR)', type: 'text', required: true, trim: true },
            { name: 'name', label: 'Name', type: 'text', required: true, trim: true },
            { name: 'direction', label: 'Direction', type: 'select', options: ['ltr', 'rtl'], value: 'ltr' },
          ],
          onSubmit: (values) => api('/languages', { method: 'POST', body: values }).then(load),
        }),
    });
  }
  await load();
}
