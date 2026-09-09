import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/auth",
        destination: "/",
        permanent: false,
      },
      {
        source: "/pages",
        destination: "/home",
        permanent: false,
      },
      {
        source: "/pages/:path*",
        destination: "/:path*",
        permanent: false,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/home",
        destination: "/pages",
      },
      {
        source: "/workplace/:path*",
        destination: "/pages/workplace/:path*",
      },
      {
        source: "/domain",
        destination: "/pages/domain",
      },
      {
        source: "/projects/:path*",
        destination: "/pages/projects/:path*",
      },
      {
        source: "/metrics/:path*",
        destination: "/pages/metrics/:path*",
      },
      {
        source: "/resources",
        destination: "/pages/resources",
      },
      {
        source: "/integrations",
        destination: "/pages/integrations",
      },
      {
        source: "/billing-management/:path*",
        destination: "/pages/billing-management/:path*",
      },
      {
        source: "/settings",
        destination: "/pages/settings",
      },
      {
        source: "/customer-support",
        destination: "/pages/customer-support",
      },
      {
        source: "/updates",
        destination: "/pages/updates",
      },
    ];
  },
};

export default nextConfig;
