import { requireAuth } from '@/lib/auth/require-role';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ProposalEditor } from './proposal-editor';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { EnquiryBanner } from '@/components/enquiry-banner';

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
      .select('*')
      .eq('id', proposal.enquiry_id)
      .single();
    enquiry = data;
  }

  const [
    { data: hotels },
    { data: flights },
    { data: itineraryDays },
    { data: lineItems },
    { data: suppliers },
    { data: comments },
    { data: versions },
  ] = await Promise.all([
    supabase.from('hotels').select('*').eq('proposal_id', id).order('sort_order'),
    supabase.from('flights').select('*').eq('proposal_id', id).order('sort_order'),
    supabase.from('itinerary_days').select('*').eq('proposal_id', id).order('day_number'),
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

      {proposal.trip_id && (
        <div className="mb-2 inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-100 border border-blue-200 rounded text-xs font-mono text-blue-700">
          Trip: {proposal.trip_id}
        </div>
      )}

      {enquiry && <EnquiryBanner enquiry={enquiry} />}
      <ProposalEditor
        proposal={proposal}
        hotels={hotels || []}
        flights={flights || []}
        itineraryDays={itineraryDays || []}
        lineItems={lineItems || []}
        suppliers={suppliers || []}
        comments={comments || []}
        versions={versions || []}
        currentUser={user}
      />
    </div>
  );
}
