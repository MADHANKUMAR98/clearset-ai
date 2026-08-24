/**
 * Unit tests — Operational Impact Metrics (metricsService).
 *
 * Pure-model tests only: no Snowflake connection, no network.
 * Fixtures are synthetic rows shaped like production query output.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CSDR_DAILY_PENALTY_RATE,
  computeImpactMetrics,
} from '../dist/services/metricsService.js';

const FIXED_NOW = new Date('2026-08-24T10:00:00.000Z');

const ex = (status, severity, value) => ({ STATUS: status, SEVERITY: severity, TRADE_VALUE: value });
const cs = (status, createdAt, approvedAt) => ({ STATUS: status, CREATED_AT: createdAt, APPROVED_AT: approvedAt });

test('computes open exposure, count, and critical exposure; ignores RESOLVED rows', () => {
  const metrics = computeImpactMetrics(
    [
      ex('OPEN', 'CRITICAL', 2_400_000),
      ex('INVESTIGATING', 'HIGH', 8_100_000),
      ex('PENDING_APPROVAL', 'MEDIUM', 500_000),
      ex('RESOLVED', 'CRITICAL', 99_999_999), // must be excluded everywhere
    ],
    [],
    FIXED_NOW,
  );

  assert.equal(metrics.openExceptionCount, 3);
  assert.equal(metrics.openExceptionValueUSD, 11_000_000);
  assert.equal(metrics.criticalOpenValueUSD, 2_400_000);
});

test('CSDR accrual is notional × documented rate, rounded to cents', () => {
  const metrics = computeImpactMetrics([ex('OPEN', 'LOW', 3_333_333)], [], FIXED_NOW);
  const expected = Math.round(3_333_333 * CSDR_DAILY_PENALTY_RATE * 100) / 100;
  assert.equal(metrics.csdrExposurePerDayUSD, expected);
  assert.equal(CSDR_DAILY_PENALTY_RATE, 0.00025);
});

test('turnaround averages APPROVED cases only and excludes rows missing timestamps', () => {
  const metrics = computeImpactMetrics(
    [],
    [
      // 90 min turnaround
      cs('APPROVED', '2026-08-20T13:00:00Z', '2026-08-20T14:30:00Z'),
      // 210 min turnaround
      cs('APPROVED', '2026-08-21T09:00:00Z', new Date('2026-08-21T12:30:00.000Z')),
      // approved but missing APPROVED_AT — counted as approved, excluded from average
      cs('APPROVED', '2026-08-22T09:00:00Z', null),
      // non-approved statuses never contribute
      cs('PENDING_APPROVAL', '2026-08-22T09:00:00Z', '2026-08-22T23:00:00Z'),
    ],
    FIXED_NOW,
  );

  assert.equal(metrics.casesApproved, 3);
  assert.equal(metrics.avgApprovalTurnaroundMinutes, 150); // mean(90, 210)
});

test('no approvable timestamps yields null turnaround, never a fabricated number', () => {
  const metrics = computeImpactMetrics([], [cs('APPROVED', '2026-08-20T13:00:00Z', null)], FIXED_NOW);
  assert.equal(metrics.casesApproved, 1);
  assert.equal(metrics.avgApprovalTurnaroundMinutes, null);
});

test('empty inputs produce an honest zero-state payload', () => {
  const metrics = computeImpactMetrics([], [], FIXED_NOW);
  assert.deepEqual(
    { ...metrics, generatedAt: FIXED_NOW.toISOString() },
    {
      generatedAt: FIXED_NOW.toISOString(),
      source: 'snowflake',
      openExceptionCount: 0,
      openExceptionValueUSD: 0,
      criticalOpenValueUSD: 0,
      csdrExposurePerDayUSD: 0,
      casesApproved: 0,
      avgApprovalTurnaroundMinutes: null,
    },
  );
});
