import nextConfig from "eslint-config-next";

const config = [
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/src/generated/**",
      "**/scripts/**",
      "**/docs/**",
      "**/.git/**",
      "**/*.config.*",
    ],
  },
  ...nextConfig,
];

export default config;
