import { requireAuth } from '@/lib/auth/require-role';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ProposalEditor } from './proposal-editor';
import { BuilderV2 } from './builder-v2/builder';
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

  // Builder v2 proposals render the new cities-first builder.
  if (proposal.builder_version === 2) {
    const [{ data: destinations }, { data: groups }, { data: items }] = await Promise.all([
      supabase.from('proposal_destinations').select('*').eq('proposal_id', id).order('sort_order'),
      supabase.from('proposal_price_groups').select('*').eq('proposal_id', id).order('sort_order'),
      supabase.from('proposal_items').select('*').eq('proposal_id', id).order('sort_order'),
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
        <BuilderV2
          proposalId={id}
          proposalStatus={proposal.status}
          initialData={{
            proposal: {
              title: proposal.title,
              client_id: proposal.client_id,
              destination: proposal.destination,
              travel_start: proposal.travel_start,
              travel_end: proposal.travel_end,
              pax_adults: proposal.pax_adults ?? 2,
              pax_children: proposal.pax_children ?? 0,
              currency: proposal.currency ?? 'INR',
              gst_enabled: proposal.gst_enabled ?? false,
              gst_rate: proposal.gst_rate ?? 5,
              tcs_enabled: proposal.tcs_enabled ?? false,
              tcs_rate: proposal.tcs_rate ?? 5,
              special_notes: proposal.special_notes,
            },
            destinations: destinations || [],
            groups: (groups || []).map((g) => ({
              ...g,
              cost_amount: Number(g.cost_amount),
              markup_value: Number(g.markup_value),
              sell_amount: Number(g.sell_amount),
            })),
            items: (items || []).map((i) => ({
              ...i,
              cost_amount: i.cost_amount == null ? null : Number(i.cost_amount),
              sell_amount: i.sell_amount == null ? null : Number(i.sell_amount),
            })),
          }}
        />
      </div>
    );
  }

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
