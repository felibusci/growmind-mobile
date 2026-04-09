import type { NextConfig } from "next";

// Removed `output: "export"` so we can use API routes (needed to keep
// the Gemini API key on the server, not in the client bundle).
const nextConfig: NextConfig = {
  experimental: {
    // Allow large image payloads in server actions / API routes
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
