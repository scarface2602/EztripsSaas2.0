import { STATUS_TRANSITIONS, SUPPLIER_STATUS_LABELS } from '@/lib/types/booking-items';
import type { SupplierStatus } from '@/lib/types/booking-items';

export function validateStatusTransition(
  current: SupplierStatus,
  next: SupplierStatus
): { valid: boolean; error?: string } {
  const allowed = STATUS_TRANSITIONS[current];
  if (!allowed) {
    return { valid: false, error: `Unknown current status: ${current}` };
  }
  if (!allowed.includes(next)) {
    const currentLabel = SUPPLIER_STATUS_LABELS[current] || current;
    const nextLabel = SUPPLIER_STATUS_LABELS[next] || next;
    const allowedLabels = allowed.map(s => SUPPLIER_STATUS_LABELS[s] || s).join(', ');
    return {
      valid: false,
      error: `Cannot transition from "${currentLabel}" to "${nextLabel}". Allowed: ${allowedLabels}`,
    };
  }
  return { valid: true };
}
