import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    tanstackStart({
      server: {
        entry: "server",
      },
    }),
    react(),
    tailwindcss(),
    tsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
  ],
  optimizeDeps: {
    exclude: ["pg", "bcryptjs"],
  },
  ssr: {
    external: ["pg", "bcryptjs"],
  },
  server: {
    port: 3001,
    host: "0.0.0.0",
    allowedHosts: ["guardai.codezy.id"],
  },
});
