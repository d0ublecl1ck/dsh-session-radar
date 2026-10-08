// Unit tests for the readout's per-metric jump seat: which metrics can be
// jumped to, and how a mounted bell's walk reaches a chip press. The walk
// itself lives in the bell (it owns the cursor and the sidebar anchors), so
// this suite pins the seam only.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  JUMP_METRICS,
  createMetricJumpSeat,
  isJumpMetric,
} from '../.test-build/client/metric-jump.js'

test('every metric is jumpable except the archive', () => {
  assert.deepEqual(JUMP_METRICS, ['running', 'unread', 'pending', 'idle', 'unarchived'])
  for (const metric of JUMP_METRICS) {
    assert.equal(isJumpMetric(metric), true, metric + ' is jumpable')
  }
  assert.equal(isJumpMetric('archived'), false, 'archived rows are not openable, so they stay a count')
})

test('isJumpMetric rejects anything that is not a metric key', () => {
  assert.equal(isJumpMetric('RUNNING'), false)
  assert.equal(isJumpMetric(''), false)
  assert.equal(isJumpMetric(undefined), false)
  assert.equal(isJumpMetric(null), false)
  assert.equal(isJumpMetric(3), false)
})

test('the seat runs nothing while no bell has published a walk', () => {
  const seat = createMetricJumpSeat()
  assert.equal(seat.current(), null)
  seat.run('idle')
  seat.run('unread')
  assert.equal(seat.current(), null, 'a press without a mounted walk changes nothing')
})

test('the seat routes every metric to the published walk', () => {
  const seat = createMetricJumpSeat()
  const seen = []
  const dispose = seat.publish({ run: (metric) => { seen.push(metric) } })
  assert.notEqual(seat.current(), null)
  for (const metric of JUMP_METRICS) seat.run(metric)
  assert.deepEqual(seen, [...JUMP_METRICS], 'each press reaches the walk with its own metric')
  dispose()
  assert.equal(seat.current(), null)
  seat.run('idle')
  assert.equal(seen.length, JUMP_METRICS.length, 'a disposed seat is silent again')
})

test('a re-publish wins and the old disposer cannot clear it', () => {
  const seat = createMetricJumpSeat()
  const first = []
  const second = []
  const disposeFirst = seat.publish({ run: (metric) => { first.push(metric) } })
  seat.publish({ run: (metric) => { second.push(metric) } })
  disposeFirst()
  seat.run('running')
  assert.deepEqual(first, [], 'the replaced walk hears nothing')
  assert.deepEqual(second, ['running'], 'the live walk keeps the press')
})

test('clearing the seat with null leaves nothing to run', () => {
  const seat = createMetricJumpSeat()
  const seen = []
  seat.publish({ run: (metric) => { seen.push(metric) } })
  seat.publish(null)
  seat.run('pending')
  assert.deepEqual(seen, [])
})
