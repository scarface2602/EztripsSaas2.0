import { requireAuth } from '@/lib/auth/require-role';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ProposalEditor } from './proposal-editor';

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
  );
}
