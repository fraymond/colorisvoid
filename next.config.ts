import type { NextConfig } from "next";

// Prosody (a pronunciation/IPA learning tool) runs as its own Node service on
// Cloud Run -- it needs a persistent process, local SQLite storage, and the
// espeak-ng binary, none of which fit Vercel's serverless model. This proxies
// /tools/prosody through to that service so it appears to live on this site.
// If the backend ever moves (new Cloud Run URL, a custom domain, etc.),
// update PROSODY_BACKEND_URL below -- no DNS changes needed either way.
const PROSODY_BACKEND_URL = "https://prosody-287026006962.us-central1.run.app";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/tools/prosody", destination: `${PROSODY_BACKEND_URL}/tools/prosody` },
      { source: "/tools/prosody/:path*", destination: `${PROSODY_BACKEND_URL}/tools/prosody/:path*` },
    ];
  },
};

export default nextConfig;
