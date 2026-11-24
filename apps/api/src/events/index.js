// Copyright 2026 Csaba Tóth
// SPDX-License-Identifier: Apache-2.0

/**
 * A small in-process event bus. Handlers run one after the other; an error in one handler is reported
 * through the onError callback and never stops the emitter or the other handlers.
 */
export function createEventBus({ onError = () => {} } = {}) {
  /** @type {Map<string, Set<(payload: any) => unknown>>} */
  const handlers = new Map();
  return {
    /** @returns {() => void} unsubscribe */
    on(name, handler) {
      if (!handlers.has(name)) handlers.set(name, new Set());
      handlers.get(name).add(handler);
      return () => handlers.get(name)?.delete(handler);
    },
    async emit(name, payload) {
      for (const handler of [...(handlers.get(name) ?? [])]) {
        try {
          await handler(payload);
        } catch (error) {
          onError(error, name);
        }
      }
    },
  };
}
