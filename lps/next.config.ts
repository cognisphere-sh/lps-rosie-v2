import type { NextConfig } from "next";

// Same-origin proxy to the cognisphere harness so the browser never makes a
// cross-origin call (the harness ships no CORS headers) and the harness stays
// on localhost. `next start` runs next to `cognisphere serve` on the same box.
// ponytail: rewrites ARE the proxy — no BFF route handlers needed.
const harness = process.env.HARNESS_URL ?? "http://127.0.0.1:7331";

const config: NextConfig = {
  // Dev-only: allow HMR/asset requests from the deployed domain (set by
  // `server.sh dev`, which sources DOMAIN from the `config` file).
  allowedDevOrigins: process.env.DOMAIN ? [process.env.DOMAIN] : [],
  async rewrites() {
    return [
      // Proxy everything under /api EXCEPT /api/stock-check/* — that one is a
      // real Next route handler (the public stock-check form's backend). The
      // negative lookahead lets it fall through to the handler; afterFiles
      // rewrites otherwise run before dynamic route handlers and would swallow
      // it, proxying to the (auth-gated) harness instead.
      { source: "/api/:path((?!stock-check/).*)", destination: `${harness}/api/:path` },
      { source: "/admin/:path*", destination: `${harness}/admin/:path*` },
    ];
  },
};

export default config;
