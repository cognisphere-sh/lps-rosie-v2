import { existsSync, fstatSync, lstatSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import type { NextConfig } from 'next'
import { PHASE_PRODUCTION_BUILD } from 'next/constants'

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

const requestedDistDir = process.env.LPS_NEXT_DIST_DIR
const requestedTsconfig = process.env.LPS_NEXT_TSCONFIG
if (requestedDistDir && !/^\.next\.(check|candidate|qa)-[A-Za-z0-9][A-Za-z0-9_-]{5,80}$/.test(requestedDistDir)) {
  throw new Error('Unsafe LPS_NEXT_DIST_DIR; use the supported build scripts')
}
if (requestedTsconfig && (!requestedDistDir || requestedTsconfig !== `${requestedDistDir}.tsconfig.json`)) {
  throw new Error('Unsafe LPS_NEXT_TSCONFIG; use the supported build scripts')
}

function ownsCanonicalBuildLock() {
  try {
    const lock = process.env.LPS_LOCK_PATH
    if (!lock) return false
    const fd = fstatSync(9)
    const path = lstatSync(lock)
    if (!fd.isFile() || !path.isFile() || fd.dev !== path.dev || fd.ino !== path.ino) return false
    // Duplicate our inherited descriptor into flock's FD 9. If this process did
    // not inherit the held open-file description, nonblocking acquisition fails
    // while the real pipeline owns it. If no holder exists, acquisition attaches
    // to our still-open description and therefore remains held for this build.
    const stdio: any[] = Array(10).fill('ignore')
    stdio[9] = 9
    return spawnSync('flock', ['-n', '9', 'true'], { stdio }).status === 0
  } catch {
    return false
  }
}

const config: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: resolve(process.cwd(), '..'),
  // Explicit for both the live app (repo root) and immutable build snapshots;
  // otherwise Next walks out of nested .build-work and selects the live lock.
  turbopack: { root: resolve(process.cwd(), '..') },
  ...(requestedDistDir ? { distDir: requestedDistDir } : {}),
  ...(requestedTsconfig ? { typescript: { tsconfigPath: requestedTsconfig } } : {}),
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

export default (phase: string): NextConfig => {
  if (phase === PHASE_PRODUCTION_BUILD && (
    !requestedDistDir || !requestedTsconfig ||
    !existsSync(resolve(process.cwd(), '../.source-manifest.json')) || !ownsCanonicalBuildLock()
  )) {
    throw new Error('Direct next build is unsupported; use pnpm build or scripts/app-deploy.sh')
  }
  return config
}
