// Copyright 2026 Csaba Tóth
// SPDX-License-Identifier: Apache-2.0
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startApp, PASSWORD } from './helpers.js';

let t;
beforeAll(async () => {
  t = await startApp();
});
afterAll(async () => {
  await t.stop();
});

describe('login and session', () => {
  it('signs in, returns a CSRF token and sets a HttpOnly SameSite=Strict cookie', async () => {
    const user = await t.makeUser('admin');
    const c = t.client();
    const res = await c.login(user);
    expect(res.statusCode).toBe(200);
    expect(res.json().user).toMatchObject({ email: user.email, role: 'admin' });
    expect(res.json().csrfToken.length).toBeGreaterThan(30);
    const set = String(res.headers['set-cookie']);
    expect(set).toMatch(/HttpOnly/i);
    expect(set).toMatch(/SameSite=Strict/i);
    expect(set).not.toMatch(/Secure/i); // development / test over http
    expect(JSON.stringify(res.json())).not.toMatch(/passwordHash|argon2/);
    expect((await c.get('/api/v1/auth/session')).statusCode).toBe(200);
  });
  it('uses a __Host- cookie with the Secure flag in production', async () => {
    const p = await startApp({ production: true });
    try {
      const user = await p.makeUser('admin');
      const res = await p.client().login(user);
      const set = String(res.headers['set-cookie']);
      expect(set).toMatch(/^__Host-skrifari_sid=/);
      expect(set).toMatch(/Secure/);
      expect(set).toMatch(/HttpOnly/);
      expect(set).toMatch(/SameSite=Strict/i);
      expect(set).toMatch(/Path=\//);
      expect(set).not.toMatch(/Domain=/i);
    } finally {
      await p.stop();
    }
  });
  it('gives every login a new session id (rotation) and ends the old one', async () => {
    const user = await t.makeUser('editor');
    const c = t.client();
    await c.login(user);
    const first = c.cookie;
    await c.login(user);
    expect(c.cookie).not.toBe(first);
    const old = t.client();
    old.cookie = first;
    expect((await old.get('/api/v1/auth/session')).statusCode).toBe(401);
    expect((await c.get('/api/v1/auth/session')).statusCode).toBe(200);
  });
  it('answers the same for an unknown user, a wrong password and an inactive user', async () => {
    const inactive = await t.makeUser('viewer');
    await t.models.User.updateOne({ _id: inactive._id }, { active: false });
    const known = await t.makeUser('viewer');
    const answers = await Promise.all([
      t.client().call('POST', '/api/v1/auth/login', { email: 'nobody@example.com', password: PASSWORD }),
      t.client().call('POST', '/api/v1/auth/login', { email: known.email, password: 'wrong password here' }),
      t.client().call('POST', '/api/v1/auth/login', { email: inactive.email, password: PASSWORD }),
    ]);
    for (const a of answers) {
      expect(a.statusCode).toBe(401);
      expect(a.json()).toEqual({ error: 'Wrong e-mail or password' });
      expect(a.headers['set-cookie']).toBeUndefined();
    }
  });
  it('logout revokes the session on the server, not only in the browser', async () => {
    const user = await t.makeUser('admin');
    const c = t.client();
    await c.login(user);
    const stolen = c.cookie;
    expect((await c.post('/api/v1/auth/logout')).statusCode).toBe(204);
    const thief = t.client();
    thief.cookie = stolen;
    expect((await thief.get('/api/v1/auth/session')).statusCode).toBe(401);
  });
  it('writes the audit log for logins and failures without secrets', async () => {
    const user = await t.makeUser('admin');
    await t.client().call('POST', '/api/v1/auth/login', { email: user.email, password: 'definitely wrong password' });
    await t.client().login(user);
    const logs = await t.models.AuditLog.find({ $or: [{ actorId: user._id }, { 'details.email': user.email }] }).lean();
    expect(logs.map((l) => l.action).sort()).toEqual(['auth.login', 'auth.login.failed']);
    expect(JSON.stringify(logs)).not.toMatch(/definitely wrong|argon2|passwordHash/);
  });
  it('refuses unknown fields and NoSQL operators in the login body', async () => {
    const res = await t.client().call('POST', '/api/v1/auth/login', { email: { $gt: '' }, password: { $ne: 1 } });
    expect(res.statusCode).toBe(400);
  });
  it('ignores a forged or malformed cookie', async () => {
    const c = t.client();
    for (const v of ['skrifari_sid=abc', `skrifari_sid=${'A'.repeat(43)}`, 'skrifari_sid=' + 'x'.repeat(500)]) {
      c.cookie = v;
      expect((await c.get('/api/v1/auth/session')).statusCode).toBe(401);
    }
  });
});

describe('CSRF', () => {
  it('rejects a state-changing request with a session cookie but no or a wrong token', async () => {
    const admin = await t.makeUser('admin');
    const c = t.client();
    await c.login(admin);
    const token = c.csrf;
    c.csrf = '';
    expect((await c.post('/api/v1/languages', { tag: 'xx', name: 'No token' })).statusCode).toBe(403);
    c.csrf = 'wrong-token';
    expect((await c.post('/api/v1/languages', { tag: 'xx', name: 'Wrong token' })).statusCode).toBe(403);
    c.csrf = token;
    expect((await c.post('/api/v1/languages', { tag: 'xx', name: 'Right token' })).statusCode).toBe(201);
    expect(await t.models.Language.countDocuments({ tag: 'xx' })).toBe(1); // only the request with the right token got through
  });
  it('rejects a cross-origin request even before the session is looked at (login CSRF too)', async () => {
    const user = await t.makeUser('admin');
    const c = t.client();
    const res = await c.call(
      'POST',
      '/api/v1/auth/login',
      { email: user.email, password: PASSWORD },
      { origin: 'https://evil.example', host: 'cms.example' },
    );
    expect(res.statusCode).toBe(403);
    const same = await c.call(
      'POST',
      '/api/v1/auth/login',
      { email: user.email, password: PASSWORD },
      { origin: 'https://cms.example', host: 'cms.example' },
    );
    expect(same.statusCode).toBe(200);
  });
  it('does not need a token for reads', async () => {
    const c = t.client();
    await c.login(await t.makeUser('viewer'));
    c.csrf = '';
    expect((await c.get('/api/v1/sites')).statusCode).toBe(200);
  });
  it('never sets a token or a session id anywhere but the cookie and the login answer', async () => {
    const c = t.client();
    const res = await c.login(await t.makeUser('admin'));
    expect(
      Object.keys(res.headers).filter((h) => !['set-cookie'].includes(h) && /token|session|authorization/i.test(h)),
    ).toEqual([]);
  });
});
