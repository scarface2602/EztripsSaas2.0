/**
 * "Action needed" ordering for the enquiries board.
 *
 * Priority (most urgent first):
 *   1. SLA breached and still untouched
 *   2. Follow-up overdue
 *   3. New and never responded to
 *   4. Everything else, newest first
 * Closed leads (won/lost/spam) always sink to the bottom.
 */

export interface SortableLead {
  status?: string | null;
  created_at?: string | null;
  follow_up_date?: string | null;
  first_responded_at?: string | null;
  sla_breached_at?: string | null;
}

const CLOSED_STATUSES = new Set(['won', 'lost', 'spam']);

export function leadUrgency(lead: SortableLead, now: Date = new Date()): number {
  if (CLOSED_STATUSES.has(lead.status || '')) return 4;
  if (lead.sla_breached_at && !lead.first_responded_at) return 0;
  if (lead.follow_up_date) {
    const due = new Date(lead.follow_up_date);
    if (due.getTime() < now.setHours(0, 0, 0, 0)) return 1;
  }
  if (lead.status === 'new' && !lead.first_responded_at) return 2;
  return 3;
}

export function actionNeededSort<T extends SortableLead>(leads: T[]): T[] {
  const now = new Date();
  return [...leads].sort((a, b) => {
    const ua = leadUrgency(a, new Date(now));
    const ub = leadUrgency(b, new Date(now));
    if (ua !== ub) return ua - ub;
    // Within the same bucket, newest first.
    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
  });
}
