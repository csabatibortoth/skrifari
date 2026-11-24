// Copyright 2026 Csaba Tóth
// SPDX-License-Identifier: Apache-2.0
import { ROLES } from '../../database/models.js';
import { hashPassword, checkPasswordPolicy, MAX_PASSWORD_LENGTH } from '../../security/passwords.js';
import { HttpError, idParams, pageQuery, notFound } from '../../core/http.js';
import { requireRole } from '../auth/index.js';

const publicUser = (u) => ({
  id: String(u._id),
  email: u.email,
  name: u.name,
  role: u.role,
  active: u.active,
  createdAt: u.createdAt,
  updatedAt: u.updatedAt,
});
const email = { type: 'string', format: 'email', maxLength: 254 };
const fields = {
  name: { type: 'string', minLength: 1, maxLength: 120 },
  role: { type: 'string', enum: ROLES },
  active: { type: 'boolean' },
  password: { type: 'string', maxLength: MAX_PASSWORD_LENGTH },
};

/** Users: basic CRUD for administrators. Changing the password, role or state of a user ends all of that user's sessions. */
export default async function usersModule(app, { models, sessions, audit }) {
  const admin = { preHandler: requireRole('admin') };
  const policy = (password) => {
    const problem = checkPasswordPolicy(password);
    if (problem) throw new HttpError(400, problem);
  };

  app.get('/api/v1/users', { ...admin, schema: { querystring: pageQuery } }, async (request) => {
    const { limit = 50, skip = 0 } = request.query;
    const users = await models.User.find().sort({ email: 1 }).skip(skip).limit(limit).lean();
    return { items: users.map(publicUser), total: await models.User.estimatedDocumentCount() };
  });

  app.get('/api/v1/users/:id', { ...admin, schema: { params: idParams } }, async (request) => {
    const user = await models.User.findById(request.params.id).lean();
    if (!user) throw notFound();
    return publicUser(user);
  });

  app.post(
    '/api/v1/users',
    {
      ...admin,
      schema: {
        body: {
          type: 'object',
          required: ['email', 'name', 'role', 'password'],
          additionalProperties: false,
          properties: { email, ...fields },
        },
      },
    },
    async (request, reply) => {
      policy(request.body.password);
      const { password, ...rest } = request.body;
      const user = await models.User.create({ ...rest, passwordHash: await hashPassword(password) });
      await audit.record({
        actorId: request.user.id,
        action: 'user.create',
        targetType: 'user',
        targetId: String(user._id),
        ip: request.ip,
        details: { role: user.role },
      });
      return reply.code(201).send(publicUser(user));
    },
  );

  app.patch(
    '/api/v1/users/:id',
    {
      ...admin,
      schema: {
        params: idParams,
        body: { type: 'object', minProperties: 1, additionalProperties: false, properties: { email, ...fields } },
      },
    },
    async (request) => {
      const { password, ...changes } = request.body;
      const own = request.params.id === request.user.id;
      if (own && ((changes.role !== undefined && changes.role !== request.user.role) || changes.active === false)) {
        throw new HttpError(400, 'You cannot change your own role or deactivate yourself');
      }
      if (password !== undefined) {
        policy(password);
        changes.passwordHash = await hashPassword(password);
      }
      const user = await models.User.findByIdAndUpdate(
        request.params.id,
        { $set: changes },
        { new: true, runValidators: true },
      ).lean();
      if (!user) throw notFound();
      if (password !== undefined || changes.role !== undefined || changes.active !== undefined)
        await sessions.destroyAllOfUser(user._id); // revocation
      await audit.record({
        actorId: request.user.id,
        action: 'user.update',
        targetType: 'user',
        targetId: String(user._id),
        ip: request.ip,
        details: { fields: Object.keys(request.body).map((f) => (f === 'password' ? 'password' : f)) },
      });
      return publicUser(user);
    },
  );

  app.delete('/api/v1/users/:id', { ...admin, schema: { params: idParams } }, async (request, reply) => {
    if (request.params.id === request.user.id) throw new HttpError(400, 'You cannot delete yourself');
    const user = await models.User.findByIdAndDelete(request.params.id).lean();
    if (!user) throw notFound();
    await sessions.destroyAllOfUser(user._id);
    await audit.record({
      actorId: request.user.id,
      action: 'user.delete',
      targetType: 'user',
      targetId: String(user._id),
      ip: request.ip,
    });
    return reply.code(204).send();
  });
}
