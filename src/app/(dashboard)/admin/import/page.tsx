import { requireSuperAdmin } from '@/lib/auth/require-role';
import { Upload } from 'lucide-react';
import ImportClient from './import-client';

export default async function ImportPage() {
  await requireSuperAdmin();

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex items-center gap-2">
        <Upload className="h-6 w-6" />
        <div>
          <h1 className="text-2xl font-bold">Import Data</h1>
          <p className="text-sm text-muted-foreground">Bring existing customers, suppliers and packages in from Excel</p>
        </div>
      </div>
      <ImportClient />
    </div>
  );
}
