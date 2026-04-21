'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="EzTrips"
              width={40}
              height={40}
              className="object-contain"
            />
            <span className="text-xl font-bold text-[#1e3a5f]">EzTrips</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            <Link href="/" className="text-gray-600 hover:text-[#1e3a5f] font-medium">Home</Link>
            <Link href="/about" className="text-gray-600 hover:text-[#1e3a5f] font-medium">About</Link>
            <Link href="/#enquiry" className="bg-[#1e3a5f] text-white px-5 py-2 rounded-lg font-medium hover:bg-[#162d4a] transition-colors">
              Get a Quote
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            type="button"
            className="md:hidden p-2"
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6 text-[#1e3a5f]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {open ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {open && (
          <div className="md:hidden pb-4 space-y-2">
            <Link href="/" className="block px-3 py-2 text-gray-600 hover:text-[#1e3a5f] font-medium" onClick={() => setOpen(false)}>Home</Link>
            <Link href="/about" className="block px-3 py-2 text-gray-600 hover:text-[#1e3a5f] font-medium" onClick={() => setOpen(false)}>About</Link>
            <Link href="/#enquiry" className="block px-3 py-2 bg-[#1e3a5f] text-white rounded-lg font-medium text-center" onClick={() => setOpen(false)}>
              Get a Quote
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
