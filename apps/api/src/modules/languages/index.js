// Copyright 2026 Csaba Tóth
// SPDX-License-Identifier: Apache-2.0
import { BCP47 } from '../../database/models.js';
import { HttpError, idParams, pageQuery, notFound } from '../../core/http.js';
import { requireRole, requireUser } from '../auth/index.js';

const publicLanguage = (l) => ({ id: String(l._id), tag: l.tag, name: l.name, direction: l.direction });
const props = {
  tag: { type: 'string', pattern: BCP47.source, maxLength: 35 },
  name: { type: 'string', minLength: 1, maxLength: 80 },
  direction: { type: 'string', enum: ['ltr', 'rtl'] },
};

/** The language registry: unlimited BCP 47 languages. Sites pick from it. */
export default async function languagesModule(app, { models, audit }) {
  const admin = { preHandler: requireRole('admin') };

  app.get('/api/v1/languages', { preHandler: requireUser, schema: { querystring: pageQuery } }, async (request) => {
    const { limit = 50, skip = 0 } = request.query;
    return {
      items: (await models.Language.find().sort({ tag: 1 }).skip(skip).limit(limit).lean()).map(publicLanguage),
    };
  });

  app.post(
    '/api/v1/languages',
    {
      ...admin,
      schema: { body: { type: 'object', required: ['tag', 'name'], additionalProperties: false, properties: props } },
    },
    async (request, reply) => {
      const language = await models.Language.create(request.body);
      await audit.record({
        actorId: request.user.id,
        action: 'language.create',
        targetType: 'language',
        targetId: String(language._id),
        ip: request.ip,
        details: { tag: language.tag },
      });
      return reply.code(201).send(publicLanguage(language));
    },
  );

  app.patch(
    '/api/v1/languages/:id',
    {
      ...admin,
      schema: {
        params: idParams,
        body: {
          type: 'object',
          minProperties: 1,
          additionalProperties: false,
          properties: { name: props.name, direction: props.direction },
        },
      },
    },
    async (request) => {
      const language = await models.Language.findByIdAndUpdate(
        request.params.id,
        { $set: request.body },
        { new: true, runValidators: true },
      ).lean();
      if (!language) throw notFound();
      await audit.record({
        actorId: request.user.id,
        action: 'language.update',
        targetType: 'language',
        targetId: String(language._id),
        ip: request.ip,
      });
      return publicLanguage(language);
    },
  );

  app.delete('/api/v1/languages/:id', { ...admin, schema: { params: idParams } }, async (request, reply) => {
    const language = await models.Language.findById(request.params.id).lean();
    if (!language) throw notFound();
    if (await models.Site.exists({ languages: language.tag }))
      throw new HttpError(409, 'A site still uses this language');
    await models.Language.deleteOne({ _id: language._id });
    await audit.record({
      actorId: request.user.id,
      action: 'language.delete',
      targetType: 'language',
      targetId: String(language._id),
      ip: request.ip,
      details: { tag: language.tag },
    });
    return reply.code(204).send();
  });
}
