import {test} from 'node:test';
import assert from 'node:assert/strict';
import {publicHealthStatus} from '../lib/health-public.ts';

test('public health endpoint publishes only non-sensitive readiness information', () => {
  for (const ready of [true, false]) {
    const payload=publicHealthStatus(ready);
    assert.deepEqual(Object.keys(payload).sort(), ['ready','service','status']);
    assert.equal(payload.ready, ready);
    assert.equal(payload.status, ready ? 'ready' : 'unavailable');
    const serialized=JSON.stringify(payload);
    for (const confidential of ['bindings','owner','signingKey','databaseReady','schemaReady','authentication','mailTransport'])
      assert.equal(serialized.includes(confidential), false);
  }
});
