import type { NextConfig } from "next";

const pythonApiUrl =
  process.env.PYTHON_API_URL ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  transpilePackages: ["@nvidia/foundations-react-core"],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${pythonApiUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
