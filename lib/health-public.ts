// Public readiness responses must not disclose internal binding names, schema, or auth modes.
export function publicHealthStatus(ready: boolean) {
  return {
    service: 'warlike-server',
    ready,
    status: ready ? 'ready' : 'unavailable',
  } as const;
}
