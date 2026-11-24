// Copyright 2026 Csaba Tóth
// SPDX-License-Identifier: Apache-2.0
import { el } from '/admin/athena/dom.js';
import { generatePageHeader } from '/admin/athena/components.js';
import { generateAlert, showToast } from '/admin/athena/feedback.js';

/** A titled section of a page. Returns the element to fill. */
export function block(parent, title) {
  const section = el('section', { class: 'skrifari-block' }, el('h2', { text: title }));
  parent.append(section);
  return section;
}

export function header(parent, title, description) {
  generatePageHeader({ parent, title, description });
}

/** Runs a call and shows an error as a toast instead of failing silently. */
export async function guarded(action, success) {
  try {
    const result = await action();
    if (success) showToast({ message: success, type: 'success' });
    return result;
  } catch (error) {
    showToast({ message: error.message, type: 'error' });
    return undefined;
  }
}

export const errorAlert = (parent, error) => generateAlert({ parent, type: 'error', message: error.message });
