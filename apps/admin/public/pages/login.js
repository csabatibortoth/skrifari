// Copyright 2026 Csaba Tóth
// SPDX-License-Identifier: Apache-2.0
import { generateSignInForm } from '/admin/athena/forms.js';
import { el } from '/admin/athena/dom.js';
import { showToast } from '/admin/athena/feedback.js';

export default async function login(context, { app, auth, session, router }) {
  if (auth.isSignedIn()) return router.navigate('/');
  const box = el('section', { class: 'skrifari-login' }, el('h1', { text: 'Sign in to Skrifari' }));
  app.wrapper.append(box);
  generateSignInForm({
    parent: box,
    identifier: 'email',
    remember: false,
    onSubmit: async ({ username, password }) => {
      auth.signIn(await session.login(username, password)); // a wrong password throws: Athena shows the message in the form
      showToast({ message: `Welcome, ${auth.getUser().name}.`, type: 'success' });
      const next = context.query?.next; // only a path of this app is followed
      router.navigate(typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') ? next : '/');
    },
  });
}
