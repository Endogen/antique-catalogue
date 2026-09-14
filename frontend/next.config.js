/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: { proxyClientMaxBodySize: "260mb", proxyTimeout: 300000 },
  output: "standalone",
  async rewrites() {
    const backend =
      process.env.INTERNAL_API_URL ||
      process.env.API_INTERNAL_URL ||
      "http://backend:8000";
    return [
      {
        source: "/api/:path*",
        destination: `${backend}/:path*`,
      },
    ];
  },
};

export default nextConfig;
