/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    // Permite que el build complete aunque existan errores de tipos.
    // (Quitar cuando los tipos del proyecto estén estabilizados.)
    ignoreBuildErrors: true,
  },
  eslint: {
    // Permite que el build complete aunque existan warnings de ESLint.
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "kkemeknbwopgkbhefkzc.supabase.co" },
      { protocol: "https", hostname: "img.youtube.com" },
      { protocol: "https", hostname: "i.ytimg.com" },
    ],
  },
};

module.exports = nextConfig;
