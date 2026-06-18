import type { NextConfig } from "next";

// Same-origin proxy to the cognisphere harness so the browser never makes a
// cross-origin call (the harness ships no CORS headers) and the harness stays
// on localhost. `next start` runs next to `cognisphere serve` on the same box.
// ponytail: rewrites ARE the proxy — no BFF route handlers needed.
const harness = process.env.HARNESS_URL ?? "http://127.0.0.1:7331";

const config: NextConfig = {
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${harness}/api/:path*` },
      { source: "/admin/:path*", destination: `${harness}/admin/:path*` },
    ];
  },
};

export default config;
