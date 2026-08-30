import type { NextConfig } from 'next'

// The app reads its data straight from Supabase, so what it still needs from
// the cognisphere harness is proxied same-origin: the browser must stay off a
// cross-origin call (the harness ships no CORS headers) and the `pi_sid` cookie
// must ride along on the app's own domain.
//
//   /api/auth/*      — login, which mints that cookie
//   /api/gws/oauth/* — Google sign-in for the settings page. Rewritten rather
//                      than proxied through a route handler because Google
//                      redirects the *browser* to `/api/gws/oauth/callback`,
//                      which the harness authenticates with its own single-use
//                      `state` nonce. Register that URL on the app's domain as
//                      an authorized redirect URI on the Google OAuth client.
//
// Everything else (models, agent config, scheduler state) goes through
// `app/api/harness/[...path]`, which allowlists the reachable endpoints.
const harness = process.env.HARNESS_URL ?? 'http://127.0.0.1:3142'

const config: NextConfig = {
  // Dev-only: allow HMR/asset requests from the deployed domain (set by
  // `server.sh dev`, which sources DOMAIN from the `config` file). DEV_ORIGIN
  // adds one more — e.g. the LAN IP when testing on a phone.
  allowedDevOrigins: [process.env.DOMAIN, process.env.DEV_ORIGIN].filter((o): o is string => !!o),
  async redirects() {
    // The supplier portal lived at /portal until 2026-08-26; links already sent
    // to suppliers keep working.
    return [{ source: '/portal/:path*', destination: '/partner/:path*', permanent: true }]
  },
  async rewrites() {
    return [
      { source: '/api/auth/:path*', destination: `${harness}/api/auth/:path*` },
      { source: '/api/gws/oauth/:path*', destination: `${harness}/api/gws/oauth/:path*` },
    ]
  },
}

export default config
