import test from 'node:test';
import assert from 'node:assert';

import SessionCoordinator from '../lib/background/session-coordinator.js';

// The tab-level half of the cross-frame Annotate session protocol (ticket #12):
// which frames the coordinator tells about the session, and what it tells them.

const TAB = 7;
const OWNER = 'document-nonce-owner';
const PEER = 'document-nonce-peer';

function createCoordinator() {
  const broadcasts = [];
  const coordinator = new SessionCoordinator({
    broadcast: (tabId, state, ownerNonce) => {
      broadcasts.push({ tabId, state, ownerNonce });
      return Promise.resolve();
    },
  });
  return { coordinator, broadcasts };
}

test('SessionCoordinator', async (t) => {
  await t.test('a frame that boots outside a session is told there is none', async () => {
    const { coordinator, broadcasts } = createCoordinator();

    const answer = await coordinator.hello(TAB, 3, PEER);

    assert.deepStrictEqual(answer, { state: 'idle', ownerNonce: null });
    assert.deepStrictEqual(broadcasts, [], 'Nothing to announce when no session exists');
  });

  await t.test('a frame that boots mid-session joins it, and the tab is not disturbed', async () => {
    const { coordinator, broadcasts } = createCoordinator();
    await coordinator.report(TAB, 0, OWNER, 'selection');
    broadcasts.length = 0;

    const answer = await coordinator.hello(TAB, 3, PEER);

    assert.deepStrictEqual(answer, { state: 'selection', ownerNonce: OWNER });
    assert.deepStrictEqual(broadcasts, [], 'Joining an existing session announces nothing');
  });

  await t.test('a report from one frame reaches the tab with that frame as the owner', async () => {
    const { coordinator, broadcasts } = createCoordinator();

    await coordinator.report(TAB, 3, PEER, 'selection');

    assert.deepStrictEqual(broadcasts, [{ tabId: TAB, state: 'selection', ownerNonce: PEER }]);
  });

  await t.test('the same state from another frame transfers ownership and is broadcast', async () => {
    const { coordinator, broadcasts } = createCoordinator();
    await coordinator.report(TAB, 0, OWNER, 'selection');
    broadcasts.length = 0;

    await coordinator.report(TAB, 3, PEER, 'selection');

    assert.deepStrictEqual(broadcasts, [{ tabId: TAB, state: 'selection', ownerNonce: PEER }],
      'The previous owner has to learn that it is mirroring now');
  });

  await t.test('a repeated report from the current owner is not rebroadcast', async () => {
    const { coordinator, broadcasts } = createCoordinator();
    await coordinator.report(TAB, 3, PEER, 'selection');
    broadcasts.length = 0;

    await coordinator.report(TAB, 3, PEER, 'selection');

    assert.deepStrictEqual(broadcasts, []);
  });

  await t.test('a release is broadcast stamped with the frame that reported it', async () => {
    const { coordinator, broadcasts } = createCoordinator();
    await coordinator.report(TAB, 0, OWNER, 'selection');
    broadcasts.length = 0;

    await coordinator.report(TAB, 0, OWNER, 'idle');

    assert.deepStrictEqual(broadcasts, [{ tabId: TAB, state: 'idle', ownerNonce: OWNER }],
      'The stamp lets the reporting frame ignore the release it caused while it re-enters');
    assert.deepStrictEqual(await coordinator.hello(TAB, 3, PEER), { state: 'idle', ownerNonce: null });
  });

  await t.test('a release with no session to release is not broadcast', async () => {
    const { coordinator, broadcasts } = createCoordinator();

    await coordinator.report(TAB, 0, OWNER, 'idle');

    assert.deepStrictEqual(broadcasts, []);
  });

  await t.test('a new top document ends the tab session and releases every frame', async () => {
    const { coordinator, broadcasts } = createCoordinator();
    await coordinator.report(TAB, 3, PEER, 'editing');
    broadcasts.length = 0;

    const answer = await coordinator.hello(TAB, 0, 'fresh-top-document');

    assert.deepStrictEqual(answer, { state: 'idle', ownerNonce: null });
    assert.deepStrictEqual(broadcasts, [{ tabId: TAB, state: 'idle', ownerNonce: null }]);
  });

  await t.test('a subframe navigating does not end the session the rest of the tab uses', async () => {
    const { coordinator, broadcasts } = createCoordinator();
    await coordinator.report(TAB, 0, OWNER, 'selection');
    broadcasts.length = 0;

    const answer = await coordinator.hello(TAB, 3, PEER);

    assert.deepStrictEqual(answer, { state: 'selection', ownerNonce: OWNER });
    assert.deepStrictEqual(broadcasts, []);
  });

  await t.test('the owner document being replaced releases the tab instead of stranding peers', async () => {
    const { coordinator, broadcasts } = createCoordinator();
    await coordinator.report(TAB, 3, OWNER, 'selection');
    broadcasts.length = 0;

    const answer = await coordinator.hello(TAB, 3, 'replacement-document');

    assert.deepStrictEqual(answer, { state: 'idle', ownerNonce: null });
    assert.deepStrictEqual(broadcasts, [{ tabId: TAB, state: 'idle', ownerNonce: null }]);
  });

  await t.test('a mirror document being replaced leaves the session alone', async () => {
    const { coordinator, broadcasts } = createCoordinator();
    await coordinator.report(TAB, 0, OWNER, 'selection');
    broadcasts.length = 0;

    const answer = await coordinator.hello(TAB, 3, 'a-second-document');

    assert.deepStrictEqual(answer, { state: 'selection', ownerNonce: OWNER });
    assert.deepStrictEqual(broadcasts, []);
  });

  await t.test('sessions are per tab', async () => {
    const { coordinator, broadcasts } = createCoordinator();
    await coordinator.report(TAB, 0, OWNER, 'selection');
    broadcasts.length = 0;

    assert.deepStrictEqual(await coordinator.hello(TAB + 1, 3, PEER), { state: 'idle', ownerNonce: null });
    assert.deepStrictEqual(broadcasts, []);
  });

  await t.test('a closed tab forgets its session', async () => {
    const { coordinator } = createCoordinator();
    await coordinator.report(TAB, 0, OWNER, 'selection');

    coordinator.forget(TAB);

    assert.deepStrictEqual(await coordinator.hello(TAB, 0, OWNER), { state: 'idle', ownerNonce: null });
  });
});
