import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * Public POST — upload passport/PAN documents for passenger details.
 * No auth required (public share link flow).
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const shareToken = formData.get('shareToken') as string | null;
    const passengerIndex = formData.get('passengerIndex') as string | null;
    const fileType = formData.get('fileType') as string | null;

    if (!file || !shareToken || passengerIndex === null || !fileType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!['passport', 'pan'].includes(fileType)) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
    }

    const serviceClient = createServiceClient();

    // Verify share token is valid
    const { data: proposal } = await serviceClient
      .from('proposals')
      .select('id')
      .eq('share_token', shareToken)
      .in('status', ['published', 'confirmed'])
      .single();

    if (!proposal) {
      return NextResponse.json({ error: 'Invalid share token' }, { status: 404 });
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${proposal.id}/${passengerIndex}/${fileType}_${Date.now()}.${ext}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await serviceClient.storage
      .from('passenger-documents')
      .upload(path, buffer, { upsert: true, contentType: file.type });

    if (uploadError) {
      console.error('Document upload error:', JSON.stringify(uploadError));
      return NextResponse.json({ error: uploadError.message || 'Upload failed' }, { status: 500 });
    }

    const { data: urlData } = serviceClient.storage
      .from('passenger-documents')
      .getPublicUrl(path);

    return NextResponse.json({ url: urlData.publicUrl });
  } catch (err) {
    console.error('Error uploading document:', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
