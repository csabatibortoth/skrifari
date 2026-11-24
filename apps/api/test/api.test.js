// Copyright 2026 Csaba Tóth
// SPDX-License-Identifier: Apache-2.0
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startApp, PASSWORD } from './helpers.js';

let t;
let admin;
let adminC;
beforeAll(async () => {
  t = await startApp();
  admin = await t.makeUser('admin');
  adminC = t.client();
  await adminC.login(admin);
});
afterAll(async () => {
  await t.stop();
});

describe('authorization', () => {
  const writes = [
    ['POST', '/api/v1/users', { email: 'a@example.com', name: 'A', role: 'viewer', password: PASSWORD }],
    ['POST', '/api/v1/languages', { tag: 'en', name: 'English' }],
    ['POST', '/api/v1/sites', { name: 'S', slug: 's', defaultLanguage: 'en' }],
    ['DELETE', '/api/v1/sites/000000000000000000000000'],
    ['GET', '/api/v1/users'],
    ['GET', '/api/v1/audit'],
  ];
  it.each(['editor', 'viewer'])('a %s cannot use the administration endpoints', async (role) => {
    const c = t.client();
    await c.login(await t.makeUser(role));
    for (const [method, url, body] of writes)
      expect((await c.call(method, url, body)).statusCode, `${method} ${url}`).toBe(403);
  });
  it('an anonymous caller gets 401 everywhere under /api/v1 except login', async () => {
    const c = t.client();
    for (const [method, url, body] of [...writes, ['GET', '/api/v1/sites'], ['GET', '/api/v1/languages']])
      expect((await c.call(method, url, body)).statusCode, `${method} ${url}`).toBe(401);
  });
  it('a deactivated user loses the session at once', async () => {
    const victim = await t.makeUser('admin');
    const c = t.client();
    await c.login(victim);
    expect((await adminC.patch(`/api/v1/users/${victim._id}`, { active: false })).statusCode).toBe(200);
    expect((await c.get('/api/v1/sites')).statusCode).toBe(401);
  });
  it('a password change revokes every session of that user', async () => {
    const victim = await t.makeUser('editor');
    const a = t.client();
    const b = t.client();
    await a.login(victim);
    await b.login(victim);
    expect(
      (await adminC.patch(`/api/v1/users/${victim._id}`, { password: 'a brand new long password' })).statusCode,
    ).toBe(200);
    expect((await a.get('/api/v1/sites')).statusCode).toBe(401);
    expect((await b.get('/api/v1/sites')).statusCode).toBe(401);
    expect((await t.client().login(victim, 'a brand new long password')).statusCode).toBe(200);
  });
});

describe('users', () => {
  it('creates, reads, updates and deletes; never returns the hash; enforces the password policy', async () => {
    const email = `new-${Date.now()}@example.com`;
    expect(
      (await adminC.post('/api/v1/users', { email, name: 'N', role: 'editor', password: 'short' })).statusCode,
    ).toBe(400);
    const created = await adminC.post('/api/v1/users', {
      email: email.toUpperCase(),
      name: 'N',
      role: 'editor',
      password: PASSWORD,
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().email).toBe(email);
    expect(created.body).not.toMatch(/passwordHash|argon2/);
    expect(
      (await adminC.post('/api/v1/users', { email, name: 'Dup', role: 'editor', password: PASSWORD })).statusCode,
    ).toBe(409);
    const id = created.json().id;
    expect((await adminC.get(`/api/v1/users/${id}`)).json().name).toBe('N');
    expect((await adminC.patch(`/api/v1/users/${id}`, { name: 'M' })).json().name).toBe('M');
    expect((await adminC.del(`/api/v1/users/${id}`)).statusCode).toBe(204);
    expect((await adminC.get(`/api/v1/users/${id}`)).statusCode).toBe(404);
  });
  it('ignores or refuses mass assignment and malformed ids', async () => {
    expect(
      (
        await adminC.post('/api/v1/users', {
          email: 'x@example.com',
          name: 'X',
          role: 'viewer',
          password: PASSWORD,
          passwordHash: 'x',
          _id: '1',
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (await adminC.post('/api/v1/users', { email: 'x@example.com', name: 'X', role: 'superuser', password: PASSWORD }))
        .statusCode,
    ).toBe(400);
    expect((await adminC.get('/api/v1/users/not-an-id')).statusCode).toBe(400);
    expect((await adminC.get('/api/v1/users/%7B%22$ne%22:1%7D')).statusCode).toBe(400);
  });
  it('an administrator cannot demote, deactivate or delete themselves', async () => {
    expect((await adminC.patch(`/api/v1/users/${admin._id}`, { role: 'viewer' })).statusCode).toBe(400);
    expect((await adminC.patch(`/api/v1/users/${admin._id}`, { active: false })).statusCode).toBe(400);
    expect((await adminC.del(`/api/v1/users/${admin._id}`)).statusCode).toBe(400);
  });
});

describe('languages, sites and domains', () => {
  it('builds a site with registered languages and refuses unknown ones', async () => {
    for (const [tag, name, direction] of [
      ['en', 'English'],
      ['hu', 'Magyar'],
      ['ar', 'Arabic', 'rtl'],
    ])
      await adminC.post('/api/v1/languages', { tag, name, ...(direction ? { direction } : {}) });
    expect((await adminC.post('/api/v1/languages', { tag: 'en', name: 'Again' })).statusCode).toBe(409);
    expect((await adminC.post('/api/v1/languages', { tag: 'not a tag', name: 'Bad' })).statusCode).toBe(400);
    expect((await adminC.post('/api/v1/sites', { name: 'Bad', slug: 'bad', defaultLanguage: 'zz' })).statusCode).toBe(
      400,
    );
    const site = await adminC.post('/api/v1/sites', {
      name: 'Main',
      slug: 'main',
      defaultLanguage: 'en',
      languages: ['hu'],
    });
    expect(site.statusCode).toBe(201);
    expect(site.json().languages.sort()).toEqual(['en', 'hu']); // the default is always one of the languages
    const id = site.json().id;
    expect((await adminC.patch(`/api/v1/sites/${id}`, { languages: ['ar'] })).json().languages.sort()).toEqual([
      'ar',
      'en',
    ]);
    expect(
      (await adminC.del(`/api/v1/languages/${(await t.models.Language.findOne({ tag: 'ar' }))._id}`)).statusCode,
    ).toBe(409); // in use
    expect((await adminC.post('/api/v1/sites', { name: 'Dup', slug: 'main', defaultLanguage: 'en' })).statusCode).toBe(
      409,
    );
  });
  it('normalizes host names, keeps them unique over all sites and refuses non-host input', async () => {
    const a = (await adminC.post('/api/v1/sites', { name: 'A', slug: 'site-a', defaultLanguage: 'en' })).json().id;
    const b = (await adminC.post('/api/v1/sites', { name: 'B', slug: 'site-b', defaultLanguage: 'en' })).json().id;
    const ok = await adminC.post(`/api/v1/sites/${a}/domains`, { hostname: 'WWW.Example.COM.', primary: true });
    expect(ok.statusCode).toBe(201);
    expect(ok.json().hostname).toBe('www.example.com');
    expect((await adminC.post(`/api/v1/sites/${b}/domains`, { hostname: 'www.example.com' })).statusCode).toBe(409);
    for (const bad of [
      'http://example.com',
      'example.com:8080',
      'example.com/path',
      '127.0.0.1',
      'ex ample.com',
      'a@b.com',
      '',
      '-bad.com',
    ])
      expect((await adminC.post(`/api/v1/sites/${a}/domains`, { hostname: bad })).statusCode, bad).toBe(400);
    expect((await adminC.post(`/api/v1/sites/${a}/domains`, { hostname: 'bücher.example' })).json().hostname).toBe(
      'xn--bcher-kva.example',
    );
    // a domain can only be removed through its own site (no cross-site delete)
    const domainId = ok.json().id;
    expect((await adminC.del(`/api/v1/sites/${b}/domains/${domainId}`)).statusCode).toBe(404);
    expect((await adminC.del(`/api/v1/sites/${a}/domains/${domainId}`)).statusCode).toBe(204);
  });
  it('deleting a site deletes its domains', async () => {
    const id = (await adminC.post('/api/v1/sites', { name: 'Gone', slug: 'gone', defaultLanguage: 'en' })).json().id;
    await adminC.post(`/api/v1/sites/${id}/domains`, { hostname: 'gone.example' });
    expect((await adminC.del(`/api/v1/sites/${id}`)).statusCode).toBe(204);
    expect(await t.models.Domain.countDocuments({ hostname: 'gone.example' })).toBe(0);
  });
});

describe('audit log', () => {
  it('records who did what and can be read by administrators only', async () => {
    const res = await adminC.get('/api/v1/audit?limit=100');
    expect(res.statusCode).toBe(200);
    const actions = res.json().items.map((e) => e.action);
    expect(actions).toEqual(expect.arrayContaining(['user.create', 'site.create', 'domain.create', 'language.create']));
    expect(res.body).not.toMatch(/argon2|passwordHash/);
    expect((await adminC.get('/api/v1/audit?limit=1000')).statusCode).toBe(400);
  });
});
