import test from 'node:test';
import assert from 'node:assert/strict';
import { computeRestBadgeView } from '../RestBadge.utils.js';

test('computeRestBadgeView returns countdown state with formatted time', () => {
  const view = computeRestBadgeView({
    remainingSeconds: 75,
    elapsedSeconds: 10,
    startingSeconds: 120,
  });

  assert.equal(view.time, '01:15');
  assert.equal(view.isElapsed, false);
  assert.equal(view.showIcon, true);
  assert.equal(view.overSeconds, 0);
});

test('computeRestBadgeView switches to elapsed state after timer hits zero', () => {
  const view = computeRestBadgeView({
    remainingSeconds: 0,
    elapsedSeconds: 130,
    startingSeconds: 120,
  });

  assert.equal(view.time, '00:10');
  assert.equal(view.isElapsed, true);
  assert.equal(view.showIcon, false);
  assert.equal(view.overSeconds, 10);
});
