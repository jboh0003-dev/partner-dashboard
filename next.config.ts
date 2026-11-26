import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@deepseek-ai/libreoffice-kit", "@deepseek-ai/libreoffice-kit-wasm"],
  outputFileTracingIncludes: {
    "/api/partner-application/contract": ["./templates/partner-contracts/*.docx", "./node_modules/@deepseek-ai/libreoffice-kit/lib/**", "./node_modules/@deepseek-ai/libreoffice-kit-wasm/**", "./assets/fonts/NotoSansKR-Regular.ttf", "./node_modules/pretendard/dist/public/static/Pretendard-*.otf"]
  },
  reactStrictMode: true
};

export default nextConfig;
