export type ApiMutation = { path: string; method: string; data: unknown };

const listeners = new Set<(mutation: ApiMutation) => void>();

export function subscribeToApiMutations(listener: (mutation: ApiMutation) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Only successful writes are published; reads and failed writes leave caches alone. */
export function publishApiMutation(mutation: ApiMutation) {
  if (!/^(POST|PUT|PATCH|DELETE)$/.test(mutation.method)) return;
  for (const listener of listeners) listener(mutation);
}
