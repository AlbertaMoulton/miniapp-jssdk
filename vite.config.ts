import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: {
    singleQuote: false,
  },
  lint: {
    ignorePatterns: ["**/dist/**", "**/dist-pages/**", "**/node_modules/**"],
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  test: {
    include: ["test/**/*.test.ts"],
  },
});
