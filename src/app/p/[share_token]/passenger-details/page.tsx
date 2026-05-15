'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

interface PassengerDetailsPageProps {
    params: { share_token: string };
}

export default function PassengerDetailsPage({ params }: PassengerDetailsPageProps) {
    const router = useRouter();
    const [proposal, setProposal] = useState<AnyRecord | null>(null);
    const [flightType, setFlightType] = useState<'international' | 'domestic' | 'none'>('none');
    const [passengers, setPassengers] = useState<AnyRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [skipDocuments, setSkipDocuments] = useState(false);

    const fetchProposalData = useCallback(async () => {
        try {
            const res = await fetch(`/api/proposals/share/${params.share_token}`);
            if (!res.ok) throw new Error('Failed to fetch proposal');

            const data = await res.json();
            setProposal(data);

            // Determine flight type
            const hasInternationalFlights = data.flights?.some((f: AnyRecord) =>
                isInternationalRoute(f.origin_iata, f.destination_iata)
            );
            const hasDomesticFlights = data.flights?.some((f: AnyRecord) =>
                !isInternationalRoute(f.origin_iata, f.destination_iata)
            );

            if (hasInternationalFlights) {
                setFlightType('international');
            } else if (hasDomesticFlights) {
                setFlightType('domestic');
            } else {
                setFlightType('none');
            }

            // Initialize passenger array
            const totalPax = (data.pax_adults || 1) + (data.pax_children || 0);
            const initPassengers = Array.from({ length: totalPax }, (_, i) => ({
                index: i,
                firstName: '',
                lastName: '',
                gender: '',
                dateOfBirth: '',
                passportFiles: [],
                panFiles: [],
                isChild: i >= (data.pax_adults || 1),
            }));
            setPassengers(initPassengers);
            setLoading(false);
        } catch (err) {
            console.error('Error fetching proposal:', err);
            toast.error('Failed to load proposal');
            setLoading(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [params.share_token]);

    useEffect(() => {
        fetchProposalData();
    }, [fetchProposalData]);

    const isInternationalRoute = (origin: string, destination: string) => {
        const indianAirports = ['DEL', 'BOM', 'BLR', 'HYD', 'CCU', 'MAA', 'PNQ', 'COK', 'AMD', 'LKO'];
        return !indianAirports.includes(origin) || !indianAirports.includes(destination);
    };

    const handlePassengerChange = (index: number, field: string, value: string | string[] | boolean) => {
        setPassengers(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            return updated;
        });
    };

    const handleFileUpload = async (index: number, fileType: 'passport' | 'pan', files: FileList) => {
        if (!files.length || !proposal) return;

        const file = files[0];
        const formData = new FormData();
        formData.append('file', file);
        formData.append('passengerIndex', index.toString());
        formData.append('fileType', fileType);
        formData.append('bookingId', proposal.booking_id);

        try {
            const res = await fetch('/api/passenger-documents/upload', {
                method: 'POST',
                body: formData,
            });

            if (!res.ok) throw new Error('Upload failed');

            const { url } = await res.json();
            const fieldName = fileType === 'passport' ? 'passportFiles' : 'panFiles';

            handlePassengerChange(index, fieldName, [...(passengers[index][fieldName] || []), url]);
            toast.success(`${fileType.charAt(0).toUpperCase() + fileType.slice(1)} uploaded`);
        } catch {
            toast.error(`Failed to upload ${fileType}`);
        }
    };

    const validatePassengers = () => {
        // All names required
        if (passengers.some(p => !p.firstName || !p.lastName)) {
            toast.error('All passenger names are required');
            return false;
        }

        // All genders required
        if (passengers.some(p => !p.gender)) {
            toast.error('Gender is required for all passengers');
            return false;
        }

        // Children DOB required
        if (passengers.some(p => p.isChild && !p.dateOfBirth)) {
            toast.error('Date of birth is required for children');
            return false;
        }

        // Flight-specific validations
        if (flightType === 'international') {
            // At least one passport per passenger
            if (passengers.some(p => !p.passportFiles || p.passportFiles.length === 0)) {
                toast.error('Passport upload required for all passengers');
                return false;
            }

            // At least one PAN across all passengers
            const totalPanFiles = passengers.reduce((sum, p) => sum + (p.panFiles?.length || 0), 0);
            if (totalPanFiles === 0) {
                toast.error('At least one PAN card is required for international bookings');
                return false;
            }
        }

        return true;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validatePassengers()) return;

        setSubmitting(true);
        try {
            const res = await fetch(`/api/bookings/${proposal!.booking_id}/passenger-details`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    passengers,
                    skipDocuments,
                }),
            });

            if (!res.ok) throw new Error('Failed to save details');

            toast.success('Details saved! Proceeding to payment...');
            router.push(`/p/${params.share_token}/payment`);
        } catch (err) {
            console.error('Error saving details:', err);
            toast.error('Failed to save passenger details');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;

    return (
        <div className="min-h-screen bg-ez-light py-12 px-4">
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-ez-primary mb-2">Confirm Your Details</h1>
                    <p className="text-gray-600">We need passenger information for your booking</p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>
                            {flightType === 'international' && 'Passport & Identity Information'}
                            {flightType === 'domestic' && 'Passenger Names (As per Government ID)'}
                            {flightType === 'none' && 'Lead Passenger Information'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-8">
                            {/* Passenger Forms */}
                            {passengers.map((pax, index) => (
                                <div key={index} className="border-b pb-6 last:border-b-0">
                                    <div className="bg-ez-light p-4 rounded-lg mb-4">
                                        <h3 className="font-semibold text-ez-primary">
                                            {pax.isChild ? 'Child' : 'Adult'} {index + 1} of {passengers.length}
                                        </h3>
                                    </div>

                                    {/* Name Fields */}
                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <div>
                                            <Label>First Name / Given Name *</Label>
                                            <Input
                                                placeholder="First name"
                                                value={pax.firstName}
                                                onChange={(e) => handlePassengerChange(index, 'firstName', e.target.value)}
                                                required
                                            />
                                        </div>
                                        <div>
                                            <Label>Last Name / Surname *</Label>
                                            <Input
                                                placeholder="Last name"
                                                value={pax.lastName}
                                                onChange={(e) => handlePassengerChange(index, 'lastName', e.target.value)}
                                                required
                                            />
                                        </div>
                                    </div>

                                    {/* Gender */}
                                    <div className="mb-4">
                                        <Label>Gender *</Label>
                                        <RadioGroup value={pax.gender} onValueChange={(val) => handlePassengerChange(index, 'gender', val)}>
                                            <div className="flex gap-6 mt-2">
                                                <div className="flex items-center">
                                                    <RadioGroupItem value="male" id={`male-${index}`} />
                                                    <Label htmlFor={`male-${index}`} className="ml-2 cursor-pointer">Male</Label>
                                                </div>
                                                <div className="flex items-center">
                                                    <RadioGroupItem value="female" id={`female-${index}`} />
                                                    <Label htmlFor={`female-${index}`} className="ml-2 cursor-pointer">Female</Label>
                                                </div>
                                                <div className="flex items-center">
                                                    <RadioGroupItem value="other" id={`other-${index}`} />
                                                    <Label htmlFor={`other-${index}`} className="ml-2 cursor-pointer">Other</Label>
                                                </div>
                                            </div>
                                        </RadioGroup>
                                    </div>

                                    {/* DOB for Children */}
                                    {pax.isChild && (
                                        <div className="mb-4">
                                            <Label>Date of Birth *</Label>
                                            <Input
                                                type="date"
                                                value={pax.dateOfBirth}
                                                onChange={(e) => handlePassengerChange(index, 'dateOfBirth', e.target.value)}
                                                required
                                            />
                                        </div>
                                    )}

                                    {/* Passport Upload - International Only */}
                                    {flightType === 'international' && (
                                        <div className="mb-4">
                                            <Label>Passport Copy (PDF/JPG/PNG) *</Label>
                                            <div className="mt-2 border-2 border-dashed border-ez-border rounded-lg p-4 text-center cursor-pointer hover:bg-ez-light">
                                                <input
                                                    type="file"
                                                    accept=".pdf,.jpg,.jpeg,.png"
                                                    onChange={(e) => handleFileUpload(index, 'passport', e.target.files!)}
                                                    className="hidden"
                                                    id={`passport-${index}`}
                                                />
                                                <label htmlFor={`passport-${index}`} className="cursor-pointer block">
                                                    Click to upload passport
                                                </label>
                                            </div>
                                            {pax.passportFiles?.length > 0 && (
                                                <div className="mt-2 text-sm text-green-600">✓ {pax.passportFiles.length} file(s) uploaded</div>
                                            )}
                                        </div>
                                    )}

                                    {/* PAN Upload - International Only */}
                                    {flightType === 'international' && index === 0 && (
                                        <div className="mb-4 bg-blue-50 border border-blue-200 rounded p-4">
                                            <Label>PAN Card (At least one required)</Label>
                                            <p className="text-xs text-gray-600 mt-1">We need at least one PAN card for the group. You can upload multiple for different passengers.</p>
                                            <div className="mt-2 border-2 border-dashed border-ez-border rounded-lg p-4 text-center cursor-pointer hover:bg-ez-light">
                                                <input
                                                    type="file"
                                                    accept=".pdf,.jpg,.jpeg,.png"
                                                    onChange={(e) => handleFileUpload(index, 'pan', e.target.files!)}
                                                    className="hidden"
                                                    id={`pan-${index}`}
                                                />
                                                <label htmlFor={`pan-${index}`} className="cursor-pointer block">
                                                    Click to upload PAN card
                                                </label>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}

                            {/* Skip Documents Option - No Flights Only */}
                            {flightType === 'none' && (
                                <div className="bg-yellow-50 border border-yellow-200 rounded p-4 mt-6">
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="checkbox"
                                            id="skip-docs"
                                            checked={skipDocuments}
                                            onChange={(e) => setSkipDocuments(e.target.checked)}
                                        />
                                        <label htmlFor="skip-docs" className="text-sm cursor-pointer">
                                            I prefer to send documents via email/WhatsApp instead
                                        </label>
                                    </div>
                                    {skipDocuments && (
                                        <p className="text-xs text-gray-600 mt-3">
                                            Our team will contact you at {proposal?.client?.email} to collect passenger details.
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Buttons */}
                            <div className="flex gap-4 pt-6">
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
                                    className="flex-1 bg-ez-secondary hover:bg-orange-700"
                                >
                                    {submitting ? 'Saving...' : 'Continue to Payment'}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
