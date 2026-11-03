import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Только для next dev: https-туннель (localhost.run) — чтобы открыть мини-апп Telegram до деплоя
  allowedDevOrigins: ["*.lhr.life"],
  partialPrefetching: true,
  experimental: {
    // Общая 404 для неизвестных адресов: у сайта корневой layout в app/[lang], у админки — свой.
    globalNotFound: true,
    // Загрузка нескольких фото с телефона за раз (в админке).
    // TUNNEL_ORIGINS="*.lhr.life" — только для показа мини-аппа Telegram через https-туннель до деплоя:
    // форма приходит с адреса туннеля, иначе Next отклонит server action как чужой
    serverActions: { bodySizeLimit: "50mb", ...(process.env.TUNNEL_ORIGINS && { allowedOrigins: process.env.TUNNEL_ORIGINS.split(",") }) },
    proxyClientMaxBodySize: "50mb",
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
