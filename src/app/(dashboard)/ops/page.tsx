import { redirect } from 'next/navigation';

// /ops was a read-only duplicate of the operations board.
// One ops surface: /operations (board, checklist and departures lenses).
export default function OpsRedirect() {
  redirect('/operations');
}
