/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    const apiDestination =
      process.env.BACKEND_INTERNAL_URL || 'http://localhost:8000/api/:path*';

    return [
      // Rewrite dla health check – gdy host to domena główna
      {
        source: '/health',
        has: [
          {
            type: 'host',
            value: 'crm.move37th.ai'
          }
        ],
        destination: 'http://crm.move37th.ai:8000/health'
      },
      // Rewrite dla health check – gdy host to adres load balancera
      {
        source: '/health',
        has: [
          {
            type: 'host',
            value: 'app-lb-1176488264.eu-central-1.elb.amazonaws.com'
          }
        ],
        destination: 'http://app-lb-1176488264.eu-central-1.elb.amazonaws.com:8000/health'
      },
      // Rewrite dla endpointów API
      {
        source: '/api/:path*',
        destination: apiDestination
      }
    ];
  },

  async headers() {
    return [
      {
        source: '/health',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate'
          }
        ]
      }
    ];
  },

  // WYMAGANE dla Docker deployment na Railway
  output: 'standalone',
  reactStrictMode: true,

  // Explicit env mapping - zapewnia dostępność zmiennych w runtime
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_AWS_REGION: process.env.NEXT_PUBLIC_AWS_REGION,
    NEXT_PUBLIC_COGNITO_CLIENT_ID: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID,
    NEXT_PUBLIC_COGNITO_USER_POOL_ID: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID,
    NEXT_PUBLIC_HOST: process.env.NEXT_PUBLIC_HOST,
    BACKEND_INTERNAL_URL: process.env.BACKEND_INTERNAL_URL
  }
};

module.exports = nextConfig;