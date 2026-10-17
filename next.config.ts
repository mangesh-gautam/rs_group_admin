import type { NextConfig } from "next";

// All API calls go to /api/* on this origin and are proxied to the API
// gateway. Same-origin keeps the HttpOnly refresh-token cookie first-party
// (SameSite=Strict) and avoids CORS for the browser.
const API_GATEWAY_URL = process.env.API_GATEWAY_URL ?? "http://localhost:8080";
const isDev = process.env.NODE_ENV !== "production";

// Content Security Policy: only this site, plus what Firebase phone sign-in
// (reCAPTCHA + Identity Toolkit) needs. Documents open as blob: URLs, photos
// are data: URLs. CSP_REPORT_ONLY=true sends it as report-only (to diagnose).
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://www.google.com https://www.gstatic.com https://apis.google.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://www.google.com https://www.gstatic.com",
  "font-src 'self' data:",
  `connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com https://www.google.com${isDev ? " ws: wss:" : ""}`,
  "frame-src 'self' blob: https://www.google.com https://recaptcha.google.com https://*.firebaseapp.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: process.env.CSP_REPORT_ONLY === "true" ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // location is collected at sign-in; nothing else
  { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // signed-in screens and registration forms hold personal data: never cache them
      { source: "/(admin|super-admin|forms|change-password)/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${API_GATEWAY_URL}/api/:path*` },
      { source: "/api-docs/:path*", destination: `${API_GATEWAY_URL}/api-docs/:path*` },
      { source: "/openapi.json", destination: `${API_GATEWAY_URL}/openapi.json` },
      { source: "/health", destination: `${API_GATEWAY_URL}/health` },
    ];
  },
};

export default nextConfig;
