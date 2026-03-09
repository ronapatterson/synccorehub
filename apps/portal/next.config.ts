import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@synccorehub/ui", "@synccorehub/auth", "@synccorehub/database", "@synccorehub/types", "@synccorehub/email"],
  experimental: { serverComponentsExternalPackages: ["drizzle-orm", "postgres"] },
};

export default nextConfig;
