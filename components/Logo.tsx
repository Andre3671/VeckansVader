/**
 * Inline SVG of the app's weather glyph (sun behind cloud).
 *
 * Same shapes as the Android launcher icon foreground, minus the heavy drop
 * shadows that don't read well at small sizes on the web. The surrounding
 * gradient "tile" is rendered here too so the logo works on any page
 * background without needing a separate icon-background asset.
 */
export function Logo({ className = "h-12 w-12" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1024 1024"
      className={className}
      aria-hidden
      role="img"
    >
      <defs>
        <linearGradient id="logo-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#4338ca" />
          <stop offset="50%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#f43f5e" />
        </linearGradient>
        <radialGradient id="logo-glow" cx="0.3" cy="0.25" r="0.7">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="logo-sun" cx="0.4" cy="0.4" r="0.6">
          <stop offset="0%" stopColor="#fef3c7" />
          <stop offset="45%" stopColor="#fde047" />
          <stop offset="100%" stopColor="#f59e0b" />
        </radialGradient>
        <linearGradient id="logo-cloud" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#e2e8f0" />
        </linearGradient>
      </defs>

      {/* Rounded-square tile background */}
      <rect width="1024" height="1024" rx="220" fill="url(#logo-bg)" />
      <rect width="1024" height="1024" rx="220" fill="url(#logo-glow)" />

      {/* Sun */}
      <circle cx="680" cy="370" r="200" fill="url(#logo-sun)" />

      {/* Cloud */}
      <path
        d="M 290 720
           C 188 720 124 645 124 555
           C 124 470 192 405 280 405
           C 296 405 311 407 326 411
           C 354 318 442 252 545 252
           C 666 252 765 343 779 461
           C 793 459 807 458 821 458
           C 905 458 968 521 968 600
           C 968 678 905 740 821 740
           Z"
        fill="url(#logo-cloud)"
      />
    </svg>
  );
}
