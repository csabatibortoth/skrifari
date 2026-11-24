// Copyright 2026 Csaba Tóth
// SPDX-License-Identifier: Apache-2.0
import { pageQuery } from '../../core/http.js';
import { requireRole } from '../auth/index.js';

/** Read access to the audit log for administrators. The log is append-only through the API: no update, no delete. */
export default async function auditRoutes(app, { models }) {
  app.get(
    '/api/v1/audit',
    { preHandler: requireRole('admin'), schema: { querystring: pageQuery } },
    async (request) => {
      const { limit = 50, skip = 0 } = request.query;
      const items = await models.AuditLog.find().sort({ at: -1 }).skip(skip).limit(limit).lean();
      return {
        items: items.map((e) => ({
          id: String(e._id),
          at: e.at,
          actorId: e.actorId ? String(e.actorId) : null,
          action: e.action,
          targetType: e.targetType,
          targetId: e.targetId,
          siteId: e.siteId ? String(e.siteId) : null,
          ip: e.ip,
        })),
      };
    },
  );
}
