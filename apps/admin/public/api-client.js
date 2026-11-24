// Copyright 2026 Csaba Tóth
// SPDX-License-Identifier: Apache-2.0
// The API client of the admin. The session is a cookie that scripts cannot read (HttpOnly). The CSRF token lives in this module's memory only:
// never in localStorage, sessionStorage, a cookie or the URL; after a reload it is asked for again (GET /api/v1/auth/session).

let csrfToken = '';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

/** Calls the API (same origin, with the cookie). Throws an ApiError with the message the server gave. */
export async function api(path, { method = 'GET', body } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET' && csrfToken) headers['X-CSRF-Token'] = csrfToken;
  const response = await fetch(`/api/v1${path}`, {
    method,
    credentials: 'same-origin',
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(data?.error ?? response.statusText, response.status);
  return data;
}

export const session = {
  /** Who am I? Resolves with the user, or null. */
  async restore() {
    try {
      const data = await api('/auth/session');
      csrfToken = data.csrfToken;
      return data.user;
    } catch {
      csrfToken = '';
      return null;
    }
  },
  async login(email, password) {
    const data = await api('/auth/login', { method: 'POST', body: { email, password } });
    csrfToken = data.csrfToken;
    return data.user;
  },
  async logout() {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    csrfToken = '';
  },
};
