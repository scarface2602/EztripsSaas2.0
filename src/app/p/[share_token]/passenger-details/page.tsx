'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

interface PassengerDetailsPageProps {
  params: Promise<{ share_token: string }>;
}

export default function PassengerDetailsPage({ params }: PassengerDetailsPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [shareToken, setShareToken] = useState<string>('');
  const [proposal, setProposal] = useState<AnyRecord | null>(null);
  const [flightType, setFlightType] = useState<'international' | 'domestic' | 'none'>('none');
  const [passengers, setPassengers] = useState<AnyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [skipDocuments, setSkipDocuments] = useState(false);

  // Resolve params
  useEffect(() => {
    params.then(p => setShareToken(p.share_token));
  }, [params]);

  const INDIAN_AIRPORTS = ['DEL', 'BOM', 'BLR', 'HYD', 'CCU', 'MAA', 'PNQ', 'COK', 'AMD', 'LKO',
    'GOI', 'JAI', 'IXC', 'SXR', 'GAU', 'PAT', 'IXB', 'VNS', 'NAG', 'IDR',
    'TRV', 'IXR', 'BBI', 'RPR', 'IXE', 'IXA', 'DED', 'IXJ', 'IXL', 'IMF'];

  const isInternationalRoute = (origin: string, destination: string) => {
    if (!origin || !destination) return false;
    return !INDIAN_AIRPORTS.includes(origin.toUpperCase()) || !INDIAN_AIRPORTS.includes(destination.toUpperCase());
  };

  const fetchProposalData = useCallback(async () => {
    if (!shareToken) return;
    try {
      const res = await fetch(`/api/proposals/share/${shareToken}`);
      if (!res.ok) throw new Error('Failed to fetch proposal');

      const data = await res.json();
      setProposal(data);

      // Determine flight type
      const flights = data.flights || [];
      const hasInternational = flights.some((f: AnyRecord) =>
        isInternationalRoute(f.origin_iata, f.destination_iata)
      );
      const hasDomestic = flights.some((f: AnyRecord) =>
        !isInternationalRoute(f.origin_iata, f.destination_iata)
      );

      if (hasInternational) setFlightType('international');
      else if (hasDomestic) setFlightType('domestic');
      else setFlightType('none');

      // Initialize passengers — pre-populate lead from client name if available
      const totalPax = (data.pax_adults || 1) + (data.pax_children || 0);
      const clientName = data.client?.name || '';
      const nameParts = clientName.split(' ');

      // Check if previously saved passenger details exist
      const saved = data.passenger_details as AnyRecord[] | null;

      const initPassengers = Array.from({ length: totalPax }, (_, i) => {
        if (saved && saved[i]) {
          return { ...saved[i], index: i, isChild: i >= (data.pax_adults || 1) };
        }
        return {
          index: i,
          firstName: i === 0 ? nameParts[0] || '' : '',
          lastName: i === 0 && nameParts.length > 1 ? nameParts.slice(1).join(' ') : '',
          gender: '',
          dateOfBirth: '',
          passportFiles: [] as string[],
          panFiles: [] as string[],
          isChild: i >= (data.pax_adults || 1),
        };
      });
      setPassengers(initPassengers);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching proposal:', err);
      toast.error('Failed to load proposal');
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareToken]);

  useEffect(() => {
    fetchProposalData();
  }, [fetchProposalData]);

  const handlePassengerChange = (index: number, field: string, value: string | string[] | boolean) => {
    setPassengers(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleFileUpload = async (index: number, fileType: 'passport' | 'pan', files: FileList) => {
    if (!files.length || !shareToken) return;

    const file = files[0];
    const formData = new FormData();
    formData.append('file', file);
    formData.append('shareToken', shareToken);
    formData.append('passengerIndex', index.toString());
    formData.append('fileType', fileType);

    try {
      const res = await fetch('/api/passenger-documents/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Upload failed');

      const { url } = await res.json();
      const fieldName = fileType === 'passport' ? 'passportFiles' : 'panFiles';
      handlePassengerChange(index, fieldName, [...(passengers[index][fieldName] || []), url]);
      toast.success(`${fileType === 'passport' ? 'Passport' : 'PAN'} uploaded`);
    } catch {
      toast.error(`Failed to upload ${fileType}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Only validate lead passenger name (always required)
    if (!passengers[0]?.firstName || !passengers[0]?.lastName) {
      toast.error('Lead passenger name is required');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/proposals/share/${shareToken}/passenger-details`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passengers,
          skipDocuments,
        }),
      });

      if (!res.ok) throw new Error('Failed to save details');

      toast.success('Details saved!');
      // Pass through query params to payment page
      const qp = searchParams.toString();
      router.push(`/p/${shareToken}/payment${qp ? '?' + qp : ''}`);
    } catch (err) {
      console.error('Error saving details:', err);
      toast.error('Failed to save passenger details');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = () => {
    const qp = searchParams.toString();
    router.push(`/p/${shareToken}/payment${qp ? '?' + qp : ''}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const showPassportUpload = flightType === 'international';
  const showPanUpload = flightType === 'international' || flightType === 'none';
  const showAllPaxNames = flightType !== 'none';

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Passenger Details</h1>
          <p className="text-gray-600">
            {flightType === 'international' && 'Please provide passport details for all travellers'}
            {flightType === 'domestic' && 'Please provide names as per government ID'}
            {flightType === 'none' && 'Please provide lead passenger information'}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {proposal?.destination ? `Trip to ${proposal.destination}` : 'Your Trip'}
              {proposal?.pax_adults && (
                <span className="text-sm font-normal text-gray-500 ml-2">
                  {proposal.pax_adults} Adult{proposal.pax_adults > 1 ? 's' : ''}
                  {proposal.pax_children > 0 && `, ${proposal.pax_children} Child${proposal.pax_children > 1 ? 'ren' : ''}`}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {passengers.map((pax, index) => {
                // For land-only, only show lead passenger form
                if (flightType === 'none' && index > 0) return null;

                return (
                  <div key={index} className="border rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-gray-900">
                        {pax.isChild ? `Child ${index - (proposal?.pax_adults || 1) + 1}` : index === 0 ? 'Lead Passenger' : `Adult ${index + 1}`}
                      </h3>
                      {index === 0 && <span className="text-xs text-red-500">* Required</span>}
                    </div>

                    {/* Name Fields */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-sm">First Name {index === 0 && '*'}</Label>
                        <Input
                          placeholder="First name"
                          value={pax.firstName}
                          onChange={(e) => handlePassengerChange(index, 'firstName', e.target.value)}
                          required={index === 0}
                        />
                      </div>
                      <div>
                        <Label className="text-sm">Last Name {index === 0 && '*'}</Label>
                        <Input
                          placeholder="Last name"
                          value={pax.lastName}
                          onChange={(e) => handlePassengerChange(index, 'lastName', e.target.value)}
                          required={index === 0}
                        />
                      </div>
                    </div>

                    {/* Gender */}
                    {showAllPaxNames && (
                      <div>
                        <Label className="text-sm">Gender</Label>
                        <RadioGroup value={pax.gender} onValueChange={(val) => handlePassengerChange(index, 'gender', val)}>
                          <div className="flex gap-4 mt-1">
                            <div className="flex items-center">
                              <RadioGroupItem value="male" id={`male-${index}`} />
                              <Label htmlFor={`male-${index}`} className="ml-1.5 text-sm cursor-pointer">Male</Label>
                            </div>
                            <div className="flex items-center">
                              <RadioGroupItem value="female" id={`female-${index}`} />
                              <Label htmlFor={`female-${index}`} className="ml-1.5 text-sm cursor-pointer">Female</Label>
                            </div>
                            <div className="flex items-center">
                              <RadioGroupItem value="other" id={`other-${index}`} />
                              <Label htmlFor={`other-${index}`} className="ml-1.5 text-sm cursor-pointer">Other</Label>
                            </div>
                          </div>
                        </RadioGroup>
                      </div>
                    )}

                    {/* DOB for Children */}
                    {pax.isChild && (
                      <div>
                        <Label className="text-sm">Date of Birth</Label>
                        <Input
                          type="date"
                          value={pax.dateOfBirth}
                          onChange={(e) => handlePassengerChange(index, 'dateOfBirth', e.target.value)}
                        />
                      </div>
                    )}

                    {/* Passport Upload — International flights only */}
                    {showPassportUpload && (
                      <div>
                        <Label className="text-sm">Passport Copy (PDF/JPG/PNG)</Label>
                        <div className="mt-1 border-2 border-dashed border-gray-300 rounded-lg p-3 text-center cursor-pointer hover:bg-gray-50">
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={(e) => handleFileUpload(index, 'passport', e.target.files!)}
                            className="hidden"
                            id={`passport-${index}`}
                          />
                          <label htmlFor={`passport-${index}`} className="cursor-pointer block text-sm text-gray-500">
                            Click to upload passport
                          </label>
                        </div>
                        {pax.passportFiles?.length > 0 && (
                          <div className="mt-1 text-sm text-green-600">✓ {pax.passportFiles.length} file(s) uploaded</div>
                        )}
                      </div>
                    )}

                    {/* PAN Upload — International (first pax only) or land-only international */}
                    {showPanUpload && index === 0 && (
                      <div className="bg-blue-50 border border-blue-200 rounded p-3">
                        <Label className="text-sm">PAN Card (optional)</Label>
                        <p className="text-xs text-gray-500 mt-0.5">Required for international travel. You can send it later to your advisor.</p>
                        <div className="mt-2 border-2 border-dashed border-gray-300 rounded-lg p-3 text-center cursor-pointer hover:bg-white">
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={(e) => handleFileUpload(index, 'pan', e.target.files!)}
                            className="hidden"
                            id={`pan-${index}`}
                          />
                          <label htmlFor={`pan-${index}`} className="cursor-pointer block text-sm text-gray-500">
                            Click to upload PAN card
                          </label>
                        </div>
                        {pax.panFiles?.length > 0 && (
                          <div className="mt-1 text-sm text-green-600">✓ {pax.panFiles.length} file(s) uploaded</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Skip option */}
              <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="skip-docs"
                    checked={skipDocuments}
                    onChange={(e) => setSkipDocuments(e.target.checked)}
                  />
                  <label htmlFor="skip-docs" className="text-sm cursor-pointer">
                    I&apos;ll send documents to my travel advisor later via email/WhatsApp
                  </label>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  disabled={submitting}
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="flex-1"
                >
                  {submitting ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
                  ) : (
                    'Continue to Payment'
                  )}
                </Button>
              </div>

              <div className="text-center">
                <button
                  type="button"
                  onClick={handleSkip}
                  className="text-sm text-gray-500 underline hover:text-gray-700"
                >
                  Skip for now — fill details later
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
