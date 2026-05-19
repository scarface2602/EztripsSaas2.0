import { requireAuth } from '@/lib/auth/require-role';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ProposalEditor } from './proposal-editor';
import { Breadcrumbs } from '@/components/breadcrumbs';

export default async function ProposalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user } = await requireAuth();
  const supabase = await createClient();

  const { data: proposal } = await supabase
    .from('proposals')
    .select('*')
    .eq('id', id)
    .single();

  if (!proposal) redirect('/proposals');

  // Fetch enquiry info if this proposal was created from an enquiry
  let enquiry: { id: string; name: string; created_at: string } | null = null;
  if (proposal.enquiry_id) {
    const { data } = await supabase
      .from('website_enquiries')
      .select('id, name, created_at')
      .eq('id', proposal.enquiry_id)
      .single();
    enquiry = data;
  }

  const [
    { data: hotels },
    { data: flights },
    { data: itineraryDays },
    { data: activities },
    { data: lineItems },
    { data: suppliers },
    { data: comments },
    { data: versions },
  ] = await Promise.all([
    supabase.from('hotels').select('*').eq('proposal_id', id).order('sort_order'),
    supabase.from('flights').select('*').eq('proposal_id', id).order('sort_order'),
    supabase.from('itinerary_days').select('*').eq('proposal_id', id).order('day_number'),
    supabase.from('itinerary_activities').select('*').eq('proposal_id', id).order('sort_order'),
    supabase.from('line_items').select('*').eq('proposal_id', id).order('sort_order'),
    supabase.from('suppliers').select('*'),
    supabase.from('proposal_comments').select('*, users(full_name)').eq('proposal_id', id).order('created_at'),
    supabase.from('proposal_versions').select('*').eq('proposal_id', id).order('version', { ascending: false }),
  ]);

  return (
    <div>
      <Breadcrumbs items={[
        { label: 'Dashboard', href: '/' },
        { label: 'Proposals', href: '/proposals' },
        { label: proposal.title || proposal.destination || 'Untitled' },
      ]} />

      {enquiry && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
          <span className="text-blue-800">
            From enquiry by <span className="font-medium">{enquiry.name}</span> on{' '}
            {new Date(enquiry.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
          <a
            href={`/admin/website/enquiries/${enquiry.id}`}
            className="ml-auto text-blue-600 hover:underline text-xs"
          >
            View enquiry
          </a>
        </div>
      )}
      <ProposalEditor
        proposal={proposal}
        hotels={hotels || []}
        flights={flights || []}
        itineraryDays={itineraryDays || []}
        activities={activities || []}
        lineItems={lineItems || []}
        suppliers={suppliers || []}
        comments={comments || []}
        versions={versions || []}
        currentUser={user}
      />
    </div>
  );
}
