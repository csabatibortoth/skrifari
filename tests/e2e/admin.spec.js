// Copyright 2026 Csaba Tóth
// SPDX-License-Identifier: Apache-2.0
import { test, expect } from '@playwright/test';
import { E2E_EMAIL, E2E_PASSWORD } from './global-setup.js';

test('the admin signs in, works, and signs out; nothing secret reaches script-readable storage; no CSP violation', async ({
  page,
  context,
}) => {
  const problems = [];
  page.on('console', (m) => {
    // the 401 answers are expected (not signed in yet, a wrong password, after sign out); everything else, a CSP violation too, is a failure
    if (['error', 'warning'].includes(m.type()) && !/status of 401/.test(m.text())) problems.push(m.text());
  });
  page.on('pageerror', (e) => problems.push(String(e)));

  // 1. a guarded page sends an anonymous visitor to the sign-in
  await page.goto('/admin/#/sites');
  await expect(page.getByRole('heading', { name: 'Sign in to Skrifari' })).toBeVisible();

  // 2. a wrong password is refused with one neutral message
  await page.getByLabel(/e-?mail/i).fill(E2E_EMAIL);
  await page
    .getByLabel(/password/i)
    .first()
    .fill('this is the wrong password');
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page.getByText('Wrong e-mail or password')).toBeVisible();

  // 3. the right one
  await page
    .getByLabel(/password/i)
    .first()
    .fill(E2E_PASSWORD);
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page.getByRole('heading', { name: 'Sites', level: 1 })).toBeVisible(); // back to the page that was asked for (?next=)

  // 4. the session cookie is HttpOnly and SameSite=Strict; scripts see no token anywhere
  const cookies = await context.cookies();
  const sid = cookies.find((c) => c.name === 'skrifari_sid');
  expect(sid?.httpOnly).toBe(true);
  expect(sid?.sameSite).toBe('Strict');
  const exposed = await page.evaluate(() => ({
    cookie: document.cookie,
    local: JSON.stringify({ ...localStorage }),
    session: JSON.stringify({ ...sessionStorage }),
  }));
  expect(exposed.cookie).not.toContain('skrifari_sid');
  expect(exposed.local).toBe('{}');
  expect(exposed.session).toBe('{}');

  // 5. a language and a site through the UI (the CSRF token travels from memory)
  await page.goto('/admin/#/languages');
  await page.getByRole('button', { name: 'Add language' }).click();
  await page
    .getByRole('dialog')
    .getByRole('textbox', { name: /BCP 47 tag/ })
    .fill('en');
  await page.getByRole('dialog').getByRole('textbox', { name: /^Name/ }).fill('English');
  await page.getByRole('dialog').getByRole('button', { name: /save/i }).click();
  await expect(page.getByRole('cell', { name: 'English' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0); // the dialog closes after a save

  await page.goto('/admin/#/sites');
  await page.getByRole('button', { name: 'Add site' }).click();
  await page.getByRole('dialog').getByRole('textbox', { name: /^Name/ }).fill('Main site');
  await page.getByRole('dialog').getByRole('textbox', { name: /Slug/ }).fill('main');
  await page
    .getByRole('dialog')
    .getByRole('textbox', { name: /Default language/ })
    .fill('en');
  await page.getByRole('dialog').getByRole('button', { name: /save/i }).click();
  await expect(page.getByRole('cell', { name: 'Main site' })).toBeVisible();

  // 6. the audit page lists what happened
  await page.goto('/admin/#/audit');
  await expect(page.getByRole('cell', { name: 'site.create' })).toBeVisible();

  // 7. sign out ends the session on the server too
  await page.getByRole('button', { name: /E2E Admin/ }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in to Skrifari' })).toBeVisible();
  const status = await page.evaluate(async () => (await fetch('/api/v1/auth/session')).status);
  expect(status).toBe(401);

  expect(problems, problems.join('\n')).toEqual([]); // includes any Content-Security-Policy violation report
});

test('the admin app and the library come with a strict Content-Security-Policy', async ({ request }) => {
  const res = await request.get('/admin/');
  expect(res.headers()['content-security-policy']).toContain("default-src 'none'");
  expect(res.headers()['x-frame-options']).toBe('DENY');
  expect((await request.get('/admin/athena/athena-ui.js')).status()).toBe(200);
  expect((await request.get('/admin/../package.json')).status()).not.toBe(200);
});
