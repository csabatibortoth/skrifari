// Copyright 2026 Csaba Tóth
// SPDX-License-Identifier: Apache-2.0
import cookie from '@fastify/cookie';
import { cookieName, cookieOptions, safeEqual } from '../../security/sessions.js';
import { verifyPassword, verifyAgainstDummy, MAX_PASSWORD_LENGTH } from '../../security/passwords.js';
import { HttpError } from '../../core/http.js';

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Login, logout and the session of the current user; the hook that loads the session and enforces CSRF.
 * Order on every /api request: Origin check (unsafe methods) -> session lookup -> CSRF token (unsafe methods with a session).
 */
export default async function authModule(app, { config, models, sessions, audit }) {
  await app.register(cookie);
  const name = cookieName(config);
  app.decorateRequest('session', null);
  app.decorateRequest('user', null);

  app.addHook('onRequest', async (request) => {
    if (!request.url.startsWith('/api/')) return;
    if (UNSAFE.has(request.method)) {
      // A browser always sends Origin on a cross-origin unsafe request: it must be this host. (SameSite=Strict is the second wall.)
      const origin = request.headers.origin;
      if (origin !== undefined) {
        let host = null;
        try {
          host = new URL(origin).host;
        } catch {
          /* handled below */
        }
        if (host !== request.headers.host) throw new HttpError(403, 'Cross-origin request refused');
      }
    }
    const id = request.cookies?.[name];
    if (!id) return;
    const session = await sessions.get(id);
    if (!session) return;
    const user = await models.User.findById(session.userId).lean();
    if (!user || !user.active) {
      await sessions.destroy(id);
      return;
    }
    request.session = { ...session, id };
    request.user = { id: String(user._id), email: user.email, name: user.name, role: user.role };
    if (UNSAFE.has(request.method) && !safeEqual(request.headers['x-csrf-token'] ?? '', session.csrf)) {
      throw new HttpError(403, 'Missing or wrong CSRF token');
    }
  });

  const publicSession = (request) => ({ user: request.user, csrfToken: request.session.csrf });

  app.post(
    '/api/v1/auth/login',
    {
      schema: {
        body: {
          type: 'object',
          required: ['email', 'password'],
          additionalProperties: false,
          properties: {
            email: { type: 'string', maxLength: 254 },
            password: { type: 'string', minLength: 1, maxLength: MAX_PASSWORD_LENGTH },
          },
        },
      },
    },
    async (request, reply) => {
      const { email, password } = request.body;
      const user = await models.User.findOne({ email: email.trim().toLowerCase() }).select('+passwordHash').lean();
      const ok = user?.active
        ? await verifyPassword(password, user.passwordHash)
        : (await verifyAgainstDummy(password), false);
      if (!ok) {
        await audit.record({ action: 'auth.login.failed', ip: request.ip, details: { email: email.slice(0, 254) } });
        throw new HttpError(401, 'Wrong e-mail or password'); // the same answer for an unknown user, a wrong password and an inactive user
      }
      if (request.session) await sessions.destroy(request.session.id); // never keep the old id: rotation
      const { id, session } = await sessions.create(user._id, user.role);
      reply.setCookie(name, id, cookieOptions(config));
      request.session = { ...session, id };
      request.user = { id: String(user._id), email: user.email, name: user.name, role: user.role };
      await audit.record({ actorId: String(user._id), action: 'auth.login', ip: request.ip });
      return publicSession(request);
    },
  );

  app.post('/api/v1/auth/logout', async (request, reply) => {
    if (request.session) {
      await sessions.destroy(request.session.id);
      await audit.record({ actorId: request.user.id, action: 'auth.logout', ip: request.ip });
    }
    reply.clearCookie(name, { path: '/', httpOnly: true, sameSite: 'strict', secure: config.production });
    return reply.code(204).send();
  });

  app.get('/api/v1/auth/session', async (request, reply) => {
    if (!request.session) return reply.code(401).send({ error: 'Not signed in' });
    return publicSession(request);
  });
}

// Without encapsulation: the hook above must also cover the routes of the other modules (what fastify-plugin does).
authModule[Symbol.for('skip-override')] = true;

/** preHandler: the user must be signed in. */
export const requireUser = async (request) => {
  if (!request.user) throw new HttpError(401, 'Sign in first');
};
/** preHandler factory: the user must have one of the roles. */
export const requireRole =
  (...roles) =>
  async (request) => {
    if (!request.user) throw new HttpError(401, 'Sign in first');
    if (!roles.includes(request.user.role)) throw new HttpError(403, 'Not allowed');
  };
