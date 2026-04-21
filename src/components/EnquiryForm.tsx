'use client';

import { useState } from 'react';

const BUDGET_RANGES = [
  'Under 25,000',
  '25,000 – 50,000',
  '50,000 – 1,00,000',
  '1,00,000 – 2,00,000',
  '2,00,000+',
];

export default function EnquiryForm() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [destination, setDestination] = useState('');
  const [travelDate, setTravelDate] = useState('');
  const [dateFlexible, setDateFlexible] = useState(false);
  const [flexibilityDays, setFlexibilityDays] = useState('');
  const [adults, setAdults] = useState('2');
  const [children, setChildren] = useState('0');
  const [childrenAges, setChildrenAges] = useState('');
  const [budgetRange, setBudgetRange] = useState('');
  const [budgetType, setBudgetType] = useState<'per_person' | 'total'>('per_person');
  const [specialRequirements, setSpecialRequirements] = useState('');
  const [whatsappOpted, setWhatsappOpted] = useState(true);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const payload = {
      name,
      email,
      phone,
      destination,
      travel_date: travelDate || null,
      date_flexible: dateFlexible,
      flexibility_days: dateFlexible ? Number(flexibilityDays) || 0 : 0,
      adults: Number(adults) || 2,
      children: Number(children) || 0,
      children_ages: childrenAges || null,
      budget_range: budgetRange || null,
      budget_type: budgetType,
      special_requirements: specialRequirements || null,
      whatsapp_opted: whatsappOpted,
      source: 'website',
    };

    try {
      console.log('[EnquiryForm] Submitting payload:', payload);

      const res = await fetch('https://eztrips-saas.vercel.app/api/website/enquiry', {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      console.log('[EnquiryForm] Response status:', res.status, 'data:', data);

      if (!res.ok) {
        console.error('[EnquiryForm] Error response:', data);
        setError(data.error || `Server error (${res.status})`);
        return;
      }

      setSuccess(true);
    } catch (err) {
      console.error('[EnquiryForm] Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Network error — please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="text-center py-16">
        <div className="text-5xl mb-4">&#10003;</div>
        <h3 className="text-2xl font-bold text-[#1e3a5f] mb-2">Thank You!</h3>
        <p className="text-gray-600">We&apos;ve received your enquiry. Our team will get back to you within 24 hours.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Name & Email */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
          <input
            type="text"
            required
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none"
            placeholder="John Doe"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
          <input
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none"
            placeholder="john@example.com"
          />
        </div>
      </div>

      {/* Phone & Destination */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
          <input
            type="tel"
            required
            value={phone}
            onChange={e => setPhone(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none"
            placeholder="+91 98765 43210"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Destination *</label>
          <input
            type="text"
            required
            value={destination}
            onChange={e => setDestination(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none"
            placeholder="Goa, Manali, Bali..."
          />
        </div>
      </div>

      {/* Travel Date */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Travel Date</label>
        <input
          type="date"
          value={travelDate}
          onChange={e => setTravelDate(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none"
        />
        <label className="flex items-center gap-2 mt-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={dateFlexible}
            onChange={e => setDateFlexible(e.target.checked)}
          />
          My dates are flexible
        </label>
        {dateFlexible && (
          <input
            type="number"
            min="1"
            max="30"
            placeholder="Flexible by how many days?"
            value={flexibilityDays}
            onChange={e => setFlexibilityDays(e.target.value)}
            className="mt-2 w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none"
          />
        )}
      </div>

      {/* Travellers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Adults</label>
          <input
            type="number"
            min="1"
            value={adults}
            onChange={e => setAdults(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Children</label>
          <input
            type="number"
            min="0"
            value={children}
            onChange={e => setChildren(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none"
          />
        </div>
      </div>
      {Number(children) > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Children Ages</label>
          <input
            type="text"
            value={childrenAges}
            onChange={e => setChildrenAges(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none"
            placeholder="e.g. 5, 8"
          />
        </div>
      )}

      {/* Budget */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Budget Range</label>
        <select
          value={budgetRange}
          onChange={e => setBudgetRange(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none bg-white"
        >
          <option value="">Select budget range</option>
          {BUDGET_RANGES.map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>

        {/* Budget Type Toggle — outside form flow to avoid click interception */}
        <div className="flex mt-3 gap-0 rounded-lg overflow-hidden border border-gray-300 w-fit">
          <button
            type="button"
            onClick={() => setBudgetType('per_person')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              budgetType === 'per_person'
                ? 'bg-[#1e3a5f] text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            Per Person
          </button>
          <button
            type="button"
            onClick={() => setBudgetType('total')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              budgetType === 'total'
                ? 'bg-[#1e3a5f] text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            Total Group
          </button>
        </div>
      </div>

      {/* Special Requirements */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Special Requirements</label>
        <textarea
          rows={3}
          value={specialRequirements}
          onChange={e => setSpecialRequirements(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none resize-none"
          placeholder="Any special requests, dietary needs, accessibility requirements..."
        />
      </div>

      {/* WhatsApp opt-in */}
      <label className="flex items-center gap-2 text-sm text-gray-600">
        <input
          type="checkbox"
          checked={whatsappOpted}
          onChange={e => setWhatsappOpted(e.target.checked)}
        />
        Send me updates on WhatsApp
      </label>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-[#1e3a5f] text-white font-semibold py-3 px-6 rounded-lg hover:bg-[#162d4a] transition-colors disabled:opacity-60"
      >
        {loading ? 'Submitting...' : 'Submit Enquiry'}
      </button>
    </form>
  );
}
