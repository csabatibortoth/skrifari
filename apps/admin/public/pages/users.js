// Copyright 2026 Csaba Tóth
// SPDX-License-Identifier: Apache-2.0
import { generateTable } from '/admin/athena/table.js';
import { generateButton } from '/admin/athena/forms.js';
import { showFormDialog, showConfirm } from '/admin/athena/dialog.js';
import { api } from '/admin/api-client.js';
import { block, header, guarded, errorAlert } from '/admin/util.js';

const roles = ['admin', 'editor', 'viewer'];

export default async function users(_context, { app, auth }) {
  header(app.wrapper, 'Users', 'Changing a password, role or state ends all sessions of that user.');
  const section = block(app.wrapper, 'All users');
  let table = null;
  async function load() {
    try {
      const { items } = await api('/users?limit=100');
      const rows = items.map((u) => ({ ...u, state: u.active ? 'active' : 'inactive' }));
      if (table) table.setRows(rows);
      else {
        table = generateTable({
          parent: section,
          id: 'users',
          caption: 'Users',
          filter: true,
          density: 'compact',
          columns: [
            { key: 'email', label: 'E-mail' },
            { key: 'name', label: 'Name' },
            { key: 'role', label: 'Role' },
            { key: 'state', label: 'State' },
          ],
          rows,
          rowActions: [
            { label: 'Edit', onclick: edit },
            { label: 'Delete', danger: true, hidden: (row) => row.id === auth.getUser().id, onclick: remove },
          ],
        });
      }
    } catch (error) {
      errorAlert(section, error);
    }
  }
  async function remove(row) {
    if (await showConfirm({ title: 'Delete user', message: `Delete ${row.email}?`, danger: true })) {
      await guarded(() => api(`/users/${row.id}`, { method: 'DELETE' }), 'User deleted');
      await load();
    }
  }
  function edit(row) {
    const own = row.id === auth.getUser().id;
    return showFormDialog({
      title: `Edit ${row.email}`,
      fields: [
        { name: 'name', label: 'Name', type: 'text', required: true, trim: true, value: row.name },
        { name: 'role', label: 'Role', type: 'select', options: roles, value: row.role, disabled: own },
        { name: 'active', label: 'Active', type: 'switch', value: row.active, disabled: own },
        {
          name: 'password',
          label: 'New password (leave empty to keep)',
          type: 'password',
          minLength: 12,
          autocomplete: 'new-password',
          empty: 'omit',
        },
      ],
      onSubmit: async (values) => {
        const changes = Object.fromEntries(
          Object.entries(values).filter(
            ([key, value]) => value !== undefined && !(own && (key === 'role' || key === 'active')),
          ),
        );
        await api(`/users/${row.id}`, { method: 'PATCH', body: changes });
        await load();
      },
    });
  }
  generateButton({
    parent: section,
    text: 'Add user',
    onclick: () =>
      showFormDialog({
        title: 'Add user',
        fields: [
          { name: 'email', label: 'E-mail', type: 'email', required: true, trim: true },
          { name: 'name', label: 'Name', type: 'text', required: true, trim: true },
          { name: 'role', label: 'Role', type: 'select', options: roles, value: 'editor' },
          {
            name: 'password',
            label: 'Password (at least 12 characters)',
            type: 'password',
            required: true,
            minLength: 12,
            autocomplete: 'new-password',
          },
        ],
        onSubmit: (values) => api('/users', { method: 'POST', body: values }).then(load),
      }),
  });
  await load();
}
