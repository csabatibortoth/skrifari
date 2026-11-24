// Copyright 2026 Csaba Tóth
// SPDX-License-Identifier: Apache-2.0

/**
 * Audit logging (initial): who did what, to what, from where. Details must never hold passwords, tokens or session ids.
 * A failure to write is logged and never breaks the request that was audited.
 */
export function createAudit({ AuditLog }, log) {
  return {
    /** @param {{ actorId?: string, action: string, targetType?: string, targetId?: string, ip?: string, siteId?: string, details?: object }} entry */
    async record(entry) {
      try {
        await AuditLog.create(entry);
      } catch (error) {
        log.error({ err: error, action: entry.action }, 'audit write failed');
      }
    },
  };
}
