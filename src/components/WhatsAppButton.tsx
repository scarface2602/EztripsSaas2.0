'use client';

export default function WhatsAppButton() {
  return (
    <a
      href="https://wa.me/916203507070"
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-[9999] group"
      aria-label="Chat with us on WhatsApp"
    >
      <div className="relative">
        {/* Tooltip */}
        <span className="absolute bottom-full right-0 mb-2 px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          Chat with us
        </span>
        {/* Button */}
        <div className="w-14 h-14 bg-[#25D366] rounded-full flex items-center justify-center shadow-lg hover:bg-[#1ebe57] transition-colors">
          <svg viewBox="0 0 32 32" className="w-7 h-7 fill-white">
            <path d="M16.004 0h-.008C7.174 0 0 7.176 0 16c0 3.5 1.128 6.744 3.046 9.378L1.054 31.29l6.118-1.958A15.9 15.9 0 0016.004 32C24.826 32 32 24.822 32 16S24.826 0 16.004 0zm9.32 22.608c-.39 1.1-1.932 2.014-3.168 2.28-.846.18-1.95.324-5.67-1.218-4.762-1.972-7.828-6.81-8.066-7.126-.228-.316-1.918-2.554-1.918-4.872s1.214-3.456 1.644-3.928c.39-.428.924-.624 1.272-.624.154 0 .292.008.416.014.43.018.644.044.928.718.354.842 1.216 2.96 1.322 3.176.108.216.216.502.072.802-.134.306-.252.446-.468.698-.216.252-.422.446-.638.718-.198.234-.422.486-.176.928.246.44 1.094 1.804 2.35 2.922 1.616 1.438 2.978 1.886 3.402 2.094.324.16.71.128.966-.144.324-.35.724-.928 1.13-1.498.29-.406.654-.456 1.01-.306.36.144 2.278 1.074 2.668 1.27.39.196.65.29.746.456.094.166.094.966-.296 2.066z" />
          </svg>
        </div>
      </div>
    </a>
  );
}
