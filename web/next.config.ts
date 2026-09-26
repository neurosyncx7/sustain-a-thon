import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Headless render QA drives the dev server from 127.0.0.1.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
