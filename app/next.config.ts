import type { NextConfig } from 'next'

// The app reads its data straight from Supabase, so what it still needs from
// the cognisphere harness is proxied same-origin — the browser must stay off a
// cross-origin call, since the harness ships no CORS headers.
//
// Exactly one path is rewritten straight through:
//
//   /api/gws/oauth/callback — where Google redirects the *browser* after the
//                      admin approves. The harness mounts this one route
//                      OUTSIDE its auth (core/main.ts) and authenticates it
//                      with the single-use `state` nonce its start route
//                      issued, so it needs no credential from us — which is
//                      just as well, because a browser redirect can carry no
//                      bearer. Register that URL on the app's domain as an
//                      authorized redirect URI on the Google OAuth client.
//
// Everything else — models, agent config, scheduler state, and the authed half
// of the OAuth flow — goes through `app/api/harness/[...path]`, which
// allowlists the reachable endpoints and attaches the app's bearer.
//
// `/api/auth/*` was rewritten here until 2026-08-30, when the app took over
// its own sign-in (Supabase Auth). Those are real route handlers now, and a
// rewrite would shadow them.
const harness = process.env.HARNESS_URL ?? 'http://127.0.0.1:3142'

const config: NextConfig = {
  // Dev-only: allow HMR/asset requests from the deployed domain (set by
  // `server.sh dev`, which sources DOMAIN from the `config` file). DEV_ORIGIN
  // adds one more — e.g. the LAN IP when testing on a phone.
  allowedDevOrigins: [process.env.DOMAIN, process.env.DEV_ORIGIN].filter((o): o is string => !!o),
  async redirects() {
    // The supplier portal lived at /portal until 2026-08-26; links already sent
    // to suppliers keep working.
    // The handbook is static files in public/docs; its pages link relatively, so
    // /docs must land on the file itself, not a rewrite that keeps the bare path.
    // Redirects run before proxy.ts, so this is public like the pages it opens.
    return [
      { source: '/portal/:path*', destination: '/partner/:path*', permanent: true },
      { source: '/docs', destination: '/docs/index.html', permanent: false },
    ]
  },
  async rewrites() {
    return [
      { source: '/api/gws/oauth/callback', destination: `${harness}/api/gws/oauth/callback` },
    ]
  },
}

export default config
