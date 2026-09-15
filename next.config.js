/** @type {import('next').NextConfig} */

const isDev = process.env.NODE_ENV !== "production";

/**
 * Origins allowed to invoke Server Actions.
 * Derived from the deployed URL instead of being pinned to localhost, which
 * would break (or silently mis-scope) a real deployment.
 */
const appOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").host;
  } catch {
    return "localhost:3000";
  }
})();

/**
 * Content-Security-Policy.
 *
 * NOTE ON 'unsafe-inline' FOR SCRIPTS: Next.js injects inline bootstrap and
 * hydration scripts. The clean fix is a per-request nonce, but nonce handling
 * in the App Router is itself the subject of an advisory on the 14.x line, so
 * this uses 'unsafe-inline' deliberately rather than a nonce that gives a false
 * sense of safety. The app renders no user HTML (no dangerouslySetInnerHTML
 * anywhere, React escapes all interpolated values), so the practical injection
 * surface is small. Tighten this to a nonce after moving to a Next version
 * where nonce support is sound.
 *
 * 'unsafe-eval' is development-only — the dev server's HMR needs it.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  // The browser is redirected to the SSLCommerz checkout page; server-to-server
  // calls to the gateway are made from Node and are not governed by CSP.
  "connect-src 'self'",
  "form-action 'self' https://sandbox.sslcommerz.com https://securepay.sslcommerz.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // Clickjacking. frame-ancestors above is the modern control; this covers
  // browsers that still only honour the legacy header.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(self), payment=(), usb=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
];

// HSTS only in production — sending it from localhost pins http://localhost
// to https in the developer's browser and is a nuisance to undo.
if (!isDev) {
  securityHeaders.push({
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  });
}

const nextConfig = {
  reactStrictMode: true,
  // Don't advertise the framework version to scanners.
  poweredByHeader: false,
  experimental: {
    serverActions: { allowedOrigins: [appOrigin] },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // API responses should never be cached by a shared cache.
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
          ...securityHeaders,
        ],
      },
    ];
  },
};

module.exports = nextConfig;
