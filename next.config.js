/** @type {import('next').NextConfig} */

// Two build modes:
//  - APP_BUILD=1 → static export (for Capacitor/Android). API routes excluded.
//  - default     → standalone server build (for Docker deploy).
const isAppBuild = process.env.APP_BUILD === "1";

const nextConfig = {
  reactStrictMode: true,
  // App build → static export so Capacitor can bundle it.
  // Server build → standalone for the Docker image.
  output: isAppBuild ? "export" : "standalone",
  // Static export needs trailingSlash + unoptimized images for predictable
  // file URLs on Android.
  ...(isAppBuild ? { trailingSlash: true, images: { unoptimized: true } } : {}),
};

module.exports = nextConfig;
