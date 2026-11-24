// Copyright 2026 Csaba Tóth
// SPDX-License-Identifier: Apache-2.0
import { Schema } from 'mongoose';

export const ROLES = ['admin', 'editor', 'viewer'];
export const BCP47 = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;
const HOSTNAME = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/** Lower-case ASCII (punycode) hostname without port, path or trailing dot; null when it is not a plain host name. */
export function normalizeHostname(value) {
  if (typeof value !== 'string' || /[\s/:@?#\\%]/.test(value)) return null;
  try {
    const host = new URL(`http://${value.replace(/\.$/, '')}`).hostname;
    return HOSTNAME.test(host) && !/^\d+(\.\d+){3}$/.test(host) ? host : null;
  } catch {
    return null;
  }
}

const schemas = {
  User: new Schema(
    {
      email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
      name: { type: String, required: true, trim: true, maxlength: 120 },
      passwordHash: { type: String, required: true, select: false },
      role: { type: String, enum: ROLES, required: true },
      active: { type: Boolean, default: true },
    },
    { timestamps: true, strict: 'throw' },
  ),
  Language: new Schema(
    {
      tag: { type: String, required: true, match: BCP47, maxlength: 35 },
      name: { type: String, required: true, trim: true, maxlength: 80 },
      direction: { type: String, enum: ['ltr', 'rtl'], default: 'ltr' },
    },
    { timestamps: true, strict: 'throw' },
  ),
  Site: new Schema(
    {
      name: { type: String, required: true, trim: true, maxlength: 120 },
      slug: { type: String, required: true, match: /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/ },
      defaultLanguage: { type: String, required: true, match: BCP47 },
      languages: { type: [{ type: String, match: BCP47 }], default: [] },
    },
    { timestamps: true, strict: 'throw' },
  ),
  Domain: new Schema(
    {
      siteId: { type: Schema.Types.ObjectId, required: true },
      hostname: { type: String, required: true, match: HOSTNAME },
      primary: { type: Boolean, default: false },
    },
    { timestamps: true, strict: 'throw' },
  ),
  AuditLog: new Schema(
    {
      at: { type: Date, default: Date.now },
      actorId: { type: Schema.Types.ObjectId },
      action: { type: String, required: true, maxlength: 80 },
      targetType: { type: String, maxlength: 40 },
      targetId: { type: String, maxlength: 64 },
      ip: { type: String, maxlength: 64 },
      siteId: { type: Schema.Types.ObjectId },
      details: { type: Schema.Types.Mixed },
    },
    { strict: 'throw' },
  ),
};

/** Registers the models on a Mongoose connection. @param {import('mongoose').Connection} connection */
export function createModels(connection) {
  return Object.fromEntries(
    Object.entries(schemas).map(([name, schema]) => [name, connection.models[name] ?? connection.model(name, schema)]),
  );
}
