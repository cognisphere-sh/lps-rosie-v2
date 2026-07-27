import type { NextConfig } from 'next'

// The app reads its data straight from Supabase, so the only thing it still
// needs from the cognisphere harness is the login endpoint that mints the
// `pi_sid` session cookie. Proxying it same-origin keeps the browser off a
// cross-origin call (the harness ships no CORS headers) and lets the cookie
// ride along on the app's own domain.
// ponytail: one rewrite IS the whole harness integration — no BFF routes.
const harness = process.env.HARNESS_URL ?? 'http://127.0.0.1:7331'

const config: NextConfig = {
  // Dev-only: allow HMR/asset requests from the deployed domain (set by
  // `server.sh dev`, which sources DOMAIN from the `config` file). DEV_ORIGIN
  // adds one more — e.g. the LAN IP when testing on a phone.
  allowedDevOrigins: [process.env.DOMAIN, process.env.DEV_ORIGIN].filter((o) => !!o),
  async rewrites() {
    return [{ source: '/api/auth/:path*', destination: `${harness}/api/auth/:path*` }]
  },
}

export default config
