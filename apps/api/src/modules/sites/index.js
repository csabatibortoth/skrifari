// Copyright 2026 Csaba Tóth
// SPDX-License-Identifier: Apache-2.0
import { trusted } from 'mongoose';
import { BCP47, normalizeHostname } from '../../database/models.js';
import { HttpError, idParams, idSchema, pageQuery, notFound } from '../../core/http.js';
import { requireRole, requireUser } from '../auth/index.js';

const publicSite = (s) => ({
  id: String(s._id),
  name: s.name,
  slug: s.slug,
  defaultLanguage: s.defaultLanguage,
  languages: s.languages,
});
const publicDomain = (d) => ({ id: String(d._id), siteId: String(d.siteId), hostname: d.hostname, primary: d.primary });
const tag = { type: 'string', pattern: BCP47.source, maxLength: 35 };
const props = {
  name: { type: 'string', minLength: 1, maxLength: 120 },
  slug: { type: 'string', pattern: '^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$' },
  defaultLanguage: tag,
  languages: { type: 'array', items: tag, maxItems: 500, uniqueItems: true },
};

/** Sites and their domains. A host name is stored normalized (lower case, ASCII) and is unique over all sites. */
export default async function sitesModule(app, { models, audit }) {
  const admin = { preHandler: requireRole('admin') };

  // Every language of a site must be in the registry, and the default must be one of the site's languages.
  async function checkLanguages(defaultLanguage, languages) {
    const all = [...new Set([defaultLanguage, ...languages])];
    const known = new Set(
      (
        await models.Language.find({ tag: trusted({ $in: all }) })
          .select('tag')
          .lean()
      ).map((l) => l.tag),
    );
    const unknown = all.filter((t) => !known.has(t));
    if (unknown.length > 0) throw new HttpError(400, `Unknown language: ${unknown.join(', ')}`);
  }
  const withDefault = (defaultLanguage, languages) => [...new Set([defaultLanguage, ...languages])];

  app.get('/api/v1/sites', { preHandler: requireUser, schema: { querystring: pageQuery } }, async (request) => {
    const { limit = 50, skip = 0 } = request.query;
    return { items: (await models.Site.find().sort({ slug: 1 }).skip(skip).limit(limit).lean()).map(publicSite) };
  });

  app.get('/api/v1/sites/:id', { preHandler: requireUser, schema: { params: idParams } }, async (request) => {
    const site = await models.Site.findById(request.params.id).lean();
    if (!site) throw notFound();
    return publicSite(site);
  });

  app.post(
    '/api/v1/sites',
    {
      ...admin,
      schema: {
        body: {
          type: 'object',
          required: ['name', 'slug', 'defaultLanguage'],
          additionalProperties: false,
          properties: props,
        },
      },
    },
    async (request, reply) => {
      const languages = withDefault(request.body.defaultLanguage, request.body.languages ?? []);
      await checkLanguages(request.body.defaultLanguage, languages);
      const site = await models.Site.create({ ...request.body, languages });
      await audit.record({
        actorId: request.user.id,
        action: 'site.create',
        targetType: 'site',
        targetId: String(site._id),
        siteId: String(site._id),
        ip: request.ip,
      });
      return reply.code(201).send(publicSite(site));
    },
  );

  app.patch(
    '/api/v1/sites/:id',
    {
      ...admin,
      schema: {
        params: idParams,
        body: { type: 'object', minProperties: 1, additionalProperties: false, properties: props },
      },
    },
    async (request) => {
      const current = await models.Site.findById(request.params.id).lean();
      if (!current) throw notFound();
      const defaultLanguage = request.body.defaultLanguage ?? current.defaultLanguage;
      const languages = withDefault(defaultLanguage, request.body.languages ?? current.languages);
      await checkLanguages(defaultLanguage, languages);
      const site = await models.Site.findByIdAndUpdate(
        current._id,
        { $set: { ...request.body, languages } },
        { new: true, runValidators: true },
      ).lean();
      await audit.record({
        actorId: request.user.id,
        action: 'site.update',
        targetType: 'site',
        targetId: String(site._id),
        siteId: String(site._id),
        ip: request.ip,
      });
      return publicSite(site);
    },
  );

  app.delete('/api/v1/sites/:id', { ...admin, schema: { params: idParams } }, async (request, reply) => {
    const site = await models.Site.findByIdAndDelete(request.params.id).lean();
    if (!site) throw notFound();
    await models.Domain.deleteMany({ siteId: site._id });
    await audit.record({
      actorId: request.user.id,
      action: 'site.delete',
      targetType: 'site',
      targetId: String(site._id),
      siteId: String(site._id),
      ip: request.ip,
    });
    return reply.code(204).send();
  });

  // Domains
  const siteParams = { type: 'object', required: ['id'], additionalProperties: false, properties: { id: idSchema } };
  const domainParams = {
    type: 'object',
    required: ['id', 'domainId'],
    additionalProperties: false,
    properties: { id: idSchema, domainId: idSchema },
  };

  app.get('/api/v1/sites/:id/domains', { preHandler: requireUser, schema: { params: siteParams } }, async (request) => {
    if (!(await models.Site.exists({ _id: request.params.id }))) throw notFound();
    return {
      items: (await models.Domain.find({ siteId: request.params.id }).sort({ hostname: 1 }).lean()).map(publicDomain),
    };
  });

  app.post(
    '/api/v1/sites/:id/domains',
    {
      ...admin,
      schema: {
        params: siteParams,
        body: {
          type: 'object',
          required: ['hostname'],
          additionalProperties: false,
          properties: { hostname: { type: 'string', maxLength: 253 }, primary: { type: 'boolean' } },
        },
      },
    },
    async (request, reply) => {
      if (!(await models.Site.exists({ _id: request.params.id }))) throw notFound();
      const hostname = normalizeHostname(request.body.hostname);
      if (!hostname) throw new HttpError(400, 'Not a valid host name (no scheme, port, path or IP address)');
      if (request.body.primary)
        await models.Domain.updateMany({ siteId: request.params.id }, { $set: { primary: false } });
      const domain = await models.Domain.create({
        siteId: request.params.id,
        hostname,
        primary: request.body.primary ?? false,
      });
      await audit.record({
        actorId: request.user.id,
        action: 'domain.create',
        targetType: 'domain',
        targetId: String(domain._id),
        siteId: request.params.id,
        ip: request.ip,
        details: { hostname },
      });
      return reply.code(201).send(publicDomain(domain));
    },
  );

  app.delete(
    '/api/v1/sites/:id/domains/:domainId',
    { ...admin, schema: { params: domainParams } },
    async (request, reply) => {
      const domain = await models.Domain.findOneAndDelete({
        _id: request.params.domainId,
        siteId: request.params.id,
      }).lean(); // scoped by the site of the URL
      if (!domain) throw notFound();
      await audit.record({
        actorId: request.user.id,
        action: 'domain.delete',
        targetType: 'domain',
        targetId: String(domain._id),
        siteId: request.params.id,
        ip: request.ip,
        details: { hostname: domain.hostname },
      });
      return reply.code(204).send();
    },
  );
}
