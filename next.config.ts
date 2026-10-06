import type { NextConfig } from "next";

// All API calls go to /api/* on this origin and are proxied to the API
// gateway. Same-origin keeps the HttpOnly refresh-token cookie first-party
// (SameSite=Strict) and avoids CORS for the browser.
const API_GATEWAY_URL = process.env.API_GATEWAY_URL ?? "http://localhost:8080";

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_GATEWAY_URL}/api/:path*` }];
  },
};

export default nextConfig;
