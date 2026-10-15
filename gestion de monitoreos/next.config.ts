import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // jsPDF usa canvas en el servidor — necesita ser excluido del bundle de server
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(config.externals || []), "canvas"];
    }
    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
};

export default nextConfig;
