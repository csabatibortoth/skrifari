// Copyright 2026 Csaba Tóth
// SPDX-License-Identifier: Apache-2.0
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import fastifyStatic from '@fastify/static';

const here = dirname(fileURLToPath(import.meta.url));
const ADMIN_DIR = join(here, '../../../../admin/public');
// A strict Content-Security-Policy: Athena UI is written for it (no inline script, no inline style, nothing from other origins).
const CSP =
  "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; object-src 'none'";

/** Serves the admin app (plain ES modules) and the Athena UI library from node_modules under /admin/. No build step. */
export default async function adminModule(app) {
  const athenaDir = join(dirname(createRequire(import.meta.url).resolve('athena-ui-js/package.json')), 'src');
  app.addHook('onSend', async (request, reply) => {
    if (request.url.startsWith('/admin')) {
      reply.header('Content-Security-Policy', CSP);
      reply.header('X-Frame-Options', 'DENY');
      reply.header('Referrer-Policy', 'no-referrer');
    }
  });
  await app.register(fastifyStatic, {
    root: athenaDir,
    prefix: '/admin/athena/',
    decorateReply: false,
    dotfiles: 'deny',
    index: false,
  });
  await app.register(fastifyStatic, { root: ADMIN_DIR, prefix: '/admin/', dotfiles: 'deny' });
  app.get('/admin', async (_request, reply) => reply.redirect('/admin/'));
}
