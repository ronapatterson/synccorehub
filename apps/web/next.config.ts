import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@synccorehub/ui",
    "@synccorehub/auth",
    "@synccorehub/database",
    "@synccorehub/plugins",
    "@synccorehub/email",
    "@synccorehub/types",
  ],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.googleusercontent.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "http", hostname: "localhost" },
    ],
  },
  experimental: {
    serverComponentsExternalPackages: ["drizzle-orm", "postgres"],
  },
};

export default nextConfig;
