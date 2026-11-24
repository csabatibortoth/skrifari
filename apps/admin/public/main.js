// Copyright 2026 Csaba Tóth
// SPDX-License-Identifier: Apache-2.0
// The shell of the admin: header menu, router, sign-in state. Pages are loaded when first visited.
import { createApp, createRouter, createAuthState, generateMenu, showToast, el } from '/admin/athena/athena-ui.js';
import { session } from '/admin/api-client.js';

const app = await createApp({
  root: '#app',
  theme: { id: 0 },
  config: {
    generateHeadercontent: false,
    generateFooter: false,
    generateWrappercontent: false,
    header_title_text: 'Skrifari',
  },
});

// The UI's copy of "who am I" (memory only). The server decides what a person may do: this only drives menus and route guards.
const auth = createAuthState({ restore: () => session.restore() });
await auth.restore();
const shared = { auth, session, app, router: null, menu: null };

app.header.append(el('a', { class: 'skrifari-brand', attrs: { href: '#/' }, text: 'Skrifari' }));

const pages = [
  { id: '/', label: 'Overview' },
  { id: '/sites', label: 'Sites' },
  { id: '/languages', label: 'Languages' },
  { id: '/users', label: 'Users', admin: true },
  { id: '/audit', label: 'Audit log', admin: true },
];

function menuItems() {
  const user = auth.getUser();
  if (!user) return [];
  return [
    ...pages
      .filter((p) => !p.admin || user.role === 'admin')
      .map((p) => ({ id: p.id, label: p.label, href: `#${p.id}` })),
    {
      id: 'user',
      label: user.name,
      avatar: { name: user.name },
      align: 'end',
      children: [{ id: 'sign-out', label: 'Sign out' }],
    },
  ];
}

shared.menu = generateMenu({
  parent: app.header,
  items: menuItems(),
  layout: 'responsive',
  followHash: true,
  label: 'Pages',
  onNavigate: async (item) => {
    if (item.id !== 'sign-out') return;
    await session.logout();
    auth.signOut();
    showToast({ message: 'You are signed out.', type: 'info' });
    router.navigate('/login');
  },
});
auth.onChange(() => shared.menu.update({ items: menuItems() }));

let cleanup = null;
const page = (name) => async (context) => {
  cleanup?.();
  cleanup = null;
  const module = await import(`/admin/pages/${name}.js`);
  cleanup = (await module.default(context, shared)) ?? null;
};

const router = createRouter({
  outlet: 'wrapper',
  focusContent: true,
  scrollTop: true,
  titlePrefix: 'Skrifari · ',
  auth: auth.routerRules({ loginPath: '/login', homePath: '/', forbiddenPath: '/forbidden' }),
  routes: {
    '/': { handler: page('overview'), title: 'Overview', auth: true },
    '/login': { handler: page('login'), title: 'Sign in' },
    '/sites': { handler: page('sites'), title: 'Sites', auth: true },
    '/languages': { handler: page('languages'), title: 'Languages', auth: true },
    '/users': { handler: page('users'), title: 'Users', auth: true, roles: ['admin'] },
    '/audit': { handler: page('audit'), title: 'Audit log', auth: true, roles: ['admin'] },
    '/forbidden': { handler: page('forbidden'), title: 'Not allowed' },
  },
  notFound: page('notfound'),
});
shared.router = router;
router.onChange((context) => shared.menu.select(context.path));
router.start();
