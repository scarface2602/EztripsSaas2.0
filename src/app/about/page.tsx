import Link from 'next/link';
import Navbar from '@/components/Navbar';

const reasons = [
  {
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
    ),
    title: 'Expert Planning',
    desc: 'Curated itineraries by travel experts who have been there, done that.',
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: '24/7 Support',
    desc: 'Round-the-clock assistance so you never feel stranded on your trip.',
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
    title: 'Customised Itineraries',
    desc: 'Every trip is tailored to your preferences, budget, and travel style.',
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
      </svg>
    ),
    title: 'Best Price Promise',
    desc: 'Competitive pricing with no hidden costs. Transparent quotes, always.',
  },
];

export default function AboutPage() {
  return (
    <>
      <Navbar />

      {/* Hero */}
      <section className="bg-gradient-to-br from-[#1e3a5f] to-[#0f1f33] text-white py-24 text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">About EzTrips</h1>
        <p className="text-lg text-white/70 max-w-xl mx-auto">Premium travel experiences, zero hassle.</p>
      </section>

      {/* Our Story */}
      <section className="max-w-4xl mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold text-[#1e3a5f] mb-6">Our Story</h2>
        <div className="space-y-4 text-gray-600 leading-relaxed">
          <p>
            EzTrips is a premium travel agency founded by <strong>Sudeep Sharma</strong> with one
            simple mission: make travel hassle-free. We believe that planning a trip should be
            as enjoyable as the trip itself.
          </p>
          <p>
            From weekend getaways to international adventures, we handle every detail &mdash;
            flights, hotels, transfers, activities &mdash; so you can focus on making memories.
            Our team of travel experts brings deep destination knowledge and a passion for
            crafting personalised itineraries that fit your style and budget.
          </p>
          <p>
            Whether you&apos;re a solo traveller, a couple, or a large group, EzTrips ensures a
            seamless experience from enquiry to return.
          </p>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-[#1e3a5f] text-center mb-12">Why Choose Us</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {reasons.map(r => (
              <div key={r.title} className="bg-white rounded-xl p-6 shadow-sm text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#1e3a5f]/10 text-[#1e3a5f] mb-4">
                  {r.icon}
                </div>
                <h3 className="font-semibold text-lg text-[#1e3a5f] mb-2">{r.title}</h3>
                <p className="text-gray-600 text-sm">{r.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team placeholder */}
      <section className="max-w-4xl mx-auto px-4 py-20 text-center">
        <h2 className="text-3xl font-bold text-[#1e3a5f] mb-6">Our Team</h2>
        <p className="text-gray-500 mb-8">Meet the people behind your perfect trip. Team profiles coming soon.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          {['Sudeep Sharma', 'Team Member', 'Team Member'].map((name, i) => (
            <div key={i} className="bg-gray-100 rounded-xl p-8">
              <div className="w-20 h-20 rounded-full bg-[#1e3a5f]/20 mx-auto mb-4" />
              <p className="font-semibold text-[#1e3a5f]">{name}</p>
              <p className="text-sm text-gray-500">{i === 0 ? 'Founder' : 'Travel Expert'}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#1e3a5f] text-white py-16 text-center">
        <h2 className="text-3xl font-bold mb-4">Ready to Plan Your Next Trip?</h2>
        <p className="text-white/70 mb-8">Tell us where you want to go and we&apos;ll handle the rest.</p>
        <Link
          href="/#enquiry"
          className="inline-block bg-white text-[#1e3a5f] font-semibold px-8 py-3 rounded-lg hover:bg-gray-100 transition-colors"
        >
          Submit an Enquiry
        </Link>
      </section>
    </>
  );
}
