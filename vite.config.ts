import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

const projectRoot = __dirname;

export default defineConfig({
  server: {
    host: "::",
    port: 8083,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react()],
  optimizeDeps: {
    include: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
  resolve: {
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
    alias: {
      "@": path.resolve(projectRoot, "./src"),
      react: path.resolve(projectRoot, "./node_modules/react"),
      "react-dom": path.resolve(projectRoot, "./node_modules/react-dom"),
      "react/jsx-runtime": path.resolve(projectRoot, "./node_modules/react/jsx-runtime.js"),
      "react/jsx-dev-runtime": path.resolve(projectRoot, "./node_modules/react/jsx-dev-runtime.js"),
    },
  },
});
