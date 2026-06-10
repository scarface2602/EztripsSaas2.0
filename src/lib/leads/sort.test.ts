import { describe, it, expect } from 'vitest';
import { actionNeededSort, leadUrgency } from './sort';

const base = { status: 'contacted', created_at: '2026-06-01T10:00:00Z' };

describe('leadUrgency', () => {
  it('ranks SLA-breached untouched leads most urgent', () => {
    expect(leadUrgency({ ...base, status: 'new', sla_breached_at: '2026-06-01T11:00:00Z' })).toBe(0);
  });

  it('does not flag breached leads that were since responded to', () => {
    expect(
      leadUrgency({ ...base, sla_breached_at: '2026-06-01T11:00:00Z', first_responded_at: '2026-06-01T12:00:00Z' }),
    ).toBeGreaterThan(0);
  });

  it('ranks overdue follow-ups second', () => {
    expect(leadUrgency({ ...base, first_responded_at: '2026-06-01T12:00:00Z', follow_up_date: '2020-01-01' })).toBe(1);
  });

  it('sinks closed leads to the bottom', () => {
    expect(leadUrgency({ ...base, status: 'won', sla_breached_at: '2026-06-01T11:00:00Z' })).toBe(4);
    expect(leadUrgency({ ...base, status: 'lost' })).toBe(4);
  });
});

describe('actionNeededSort', () => {
  it('orders breached → overdue → new → rest → closed', () => {
    const leads = [
      { id: 'closed', status: 'won', created_at: '2026-06-09T00:00:00Z' },
      { id: 'plain', status: 'contacted', created_at: '2026-06-08T00:00:00Z', first_responded_at: '2026-06-08T01:00:00Z' },
      { id: 'new-lead', status: 'new', created_at: '2026-06-07T00:00:00Z' },
      { id: 'overdue', status: 'contacted', created_at: '2026-06-06T00:00:00Z', first_responded_at: '2026-06-06T01:00:00Z', follow_up_date: '2020-01-01' },
      { id: 'breached', status: 'new', created_at: '2026-06-05T00:00:00Z', sla_breached_at: '2026-06-05T01:00:00Z' },
    ];
    expect(actionNeededSort(leads).map(l => l.id)).toEqual(['breached', 'overdue', 'new-lead', 'plain', 'closed']);
  });

  it('keeps newest first within a bucket', () => {
    const leads = [
      { id: 'older', status: 'new', created_at: '2026-06-01T00:00:00Z' },
      { id: 'newer', status: 'new', created_at: '2026-06-09T00:00:00Z' },
    ];
    expect(actionNeededSort(leads).map(l => l.id)).toEqual(['newer', 'older']);
  });
});
