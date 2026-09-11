import { describe, expect, it } from 'vitest';
import { applyFixedWindow, type CounterClient } from '@/lib/auth/rate-limit';

/**
 * Fake Redis with the three commands the limiter uses. `ttl` follows the real
 * contract: -2 when the key is absent, -1 when it exists with no expiry.
 */
function fakeRedis(initial: { count?: number; ttl?: number } = {}) {
  const state = {
    count: initial.count ?? 0,
    ttl: initial.ttl ?? -2,
    expireCalls: 0,
  };
  const client: CounterClient = {
    async incr(_key: string) {
      state.count += 1;
      return state.count;
    },
    async ttl(_key: string) {
      return state.count === 0 ? -2 : state.ttl;
    },
    async expire(_key: string, seconds: number) {
      state.expireCalls += 1;
      state.ttl = seconds;
      return 1;
    },
  };
  return { client, state };
}

const KEY = 'login:1.2.3.4:someone@example.com';

describe('applyFixedWindow', () => {
  it('allows the first hit and starts the window', async () => {
    const { client, state } = fakeRedis();
    const result = await applyFixedWindow(client, KEY, 5, 60);
    expect(result.ok).toBe(true);
    expect(result.remaining).toBe(4);
    expect(state.expireCalls).toBe(1);
    expect(state.ttl).toBe(60);
  });

  it('allows hits up to the limit, then blocks', async () => {
    const { client } = fakeRedis();
    for (let i = 1; i <= 5; i++) {
      expect((await applyFixedWindow(client, KEY, 5, 60)).ok, `hit ${i}`).toBe(true);
    }
    expect((await applyFixedWindow(client, KEY, 5, 60)).ok).toBe(false);
  });

  it('reports the live TTL as retryAfterSeconds while blocked', async () => {
    const { client } = fakeRedis({ count: 9, ttl: 17 });
    const result = await applyFixedWindow(client, KEY, 5, 60);
    expect(result.ok).toBe(false);
    expect(result.retryAfterSeconds).toBe(17);
  });

  it('does not re-set the expiry while a window is live', async () => {
    const { client, state } = fakeRedis({ count: 1, ttl: 42 });
    await applyFixedWindow(client, KEY, 5, 60);
    expect(state.expireCalls).toBe(0);
    expect(state.ttl).toBe(42);
  });

  it('repairs a key that is stuck with no expiry', async () => {
    // The regression this exists for: INCR creates a key with no TTL, so if the
    // one expire call that should follow it failed, the key lived forever and
    // locked that ip+email out permanently.
    const { client, state } = fakeRedis({ count: 50, ttl: -1 });
    const result = await applyFixedWindow(client, KEY, 5, 60);
    expect(state.expireCalls).toBe(1);
    expect(state.ttl).toBe(60);
    expect(result.retryAfterSeconds).toBe(60);
  });

  it('a repaired key recovers on its own once the window lapses', async () => {
    const { client, state } = fakeRedis({ count: 50, ttl: -1 });
    await applyFixedWindow(client, KEY, 5, 60); // repairs: TTL now set
    state.count = 0; // window lapsed, Redis dropped the key
    state.ttl = -2;
    const after = await applyFixedWindow(client, KEY, 5, 60);
    expect(after.ok).toBe(true);
    expect(after.remaining).toBe(4);
  });

  it('sets an expiry even when the key vanished between INCR and TTL', async () => {
    const { client, state } = fakeRedis({ count: 0, ttl: -2 });
    await applyFixedWindow(client, KEY, 5, 60);
    expect(state.expireCalls).toBe(1);
  });
});
