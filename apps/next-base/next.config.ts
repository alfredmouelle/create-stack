import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Self-contained server bundle for small Docker images (VPS deployment).
  output: 'standalone',
}

export default nextConfig
