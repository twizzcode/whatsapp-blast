/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable Turbopack for production build (Vercel compatibility)
  experimental: {
    turbo: undefined
  },
  // Disable telemetry
  telemetry: false,
};

export default nextConfig;
