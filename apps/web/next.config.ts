import type { NextConfig } from 'next';

const pythonApiUrl = process.env.PYTHON_API_URL ?? 'http://127.0.0.1:3001';

const nextConfig: NextConfig = {
	transpilePackages: ['@kui/foundations-react'],
	async rewrites() {
		return [
			{
				source: '/api/:path*',
				destination: `${pythonApiUrl}/api/:path*`,
			},
		];
	},
};

export default nextConfig;
