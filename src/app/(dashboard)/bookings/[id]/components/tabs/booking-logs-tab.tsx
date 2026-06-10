'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { CheckCircle2 } from 'lucide-react';
import { useBooking } from '../../booking-context';
import { format } from 'date-fns';

export function BookingLogsTab() {
  const { logs } = useBooking();

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Activity Log</CardTitle></CardHeader>
      <CardContent>
        <div className="space-y-3">
          {logs.length === 0 ? (
            <p className="text-center py-6 text-muted-foreground">No activity yet</p>
          ) : logs.map((l: any) => (
            <div key={l.id} className="flex items-start gap-3 text-sm border-b pb-2 last:border-0">
              <CheckCircle2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="flex-1">
                <span className="font-medium">{l.action.replace(/_/g, ' ')}</span>
                {l.details && (
                  <span className="text-muted-foreground ml-2">
                    {Object.entries(l.details)
                      .filter(([, v]) => v)
                      .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`)
                      .join(' | ')}
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground whitespace-nowrap">
                {l.users?.full_name || 'System'} · {format(new Date(l.created_at), 'dd MMM HH:mm')}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
