'use client';

import { useEffect, useState } from 'react';
import { ClientSelect } from '@/components/ui/inline-add-select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface StepClientSelectProps {
  selectedClientId: string | null;
  selectedClientName: string;
  onClientSelect: (id: string, name: string) => void;
}

export default function StepClientSelect({
  selectedClientId,
  selectedClientName,
  onClientSelect,
}: StepClientSelectProps) {
  const [clients, setClients] = useState<Array<{ id: string; full_name: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const res = await fetch('/api/clients');
        if (!res.ok) throw new Error('Failed to load clients');
        const data = await res.json();
        console.log('Clients loaded:', data);
        setClients(Array.isArray(data) ? data : []);
      } catch (error) {
        toast.error('Failed to load clients');
        console.error('Client fetch error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchClients();
  }, []);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Select or Create Client</h2>
        <p className="text-sm text-muted-foreground">
          Choose an existing client or create a new one
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Client</CardTitle>
          <CardDescription>
            {selectedClientId
              ? 'Client selected - you can modify it using the dropdown'
              : 'Select a client from the list or create a new one'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading clients...
            </div>
          ) : (
            <ClientSelect
              clients={clients}
              value={selectedClientId || ''}
              onChange={(id) => {
                const client = clients.find((c) => c.id === id);
                if (client) {
                  onClientSelect(client.id, client.full_name);
                }
              }}
              onClientAdded={(client) => {
                setClients([...clients, client]);
                onClientSelect(client.id, client.full_name);
                toast.success(`Client ${client.full_name} created`);
              }}
            />
          )}
        </CardContent>
      </Card>

      {selectedClientId && selectedClientName && (
        <Card className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <div>
                <p className="font-medium text-green-900 dark:text-green-200">{selectedClientName}</p>
                <p className="text-sm text-green-700 dark:text-green-300">Selected as booking client</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!selectedClientId && !loading && (
        <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="font-medium text-yellow-900 dark:text-yellow-200">Client required</p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  Please select or create a client to proceed
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
