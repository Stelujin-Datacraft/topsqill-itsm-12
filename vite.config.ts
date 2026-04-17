import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ['react', 'react-dom', 'react/jsx-runtime', '@tanstack/react-query'],
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react/jsx-runtime'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Core framework
          'react-vendor': ['react', 'react-dom', 'react/jsx-runtime'],
          'query-vendor': ['@tanstack/react-query'],
          'router-vendor': ['react-router-dom'],
          // Heavy chart library — only loaded on Reports/Performance
          'charts-vendor': ['recharts'],
          // Rich text editor — only loaded on Knowledge Base
          'editor-vendor': ['@tiptap/react', '@tiptap/starter-kit', '@tiptap/pm'],
          // Document export libs — only on demand
          'docs-vendor': ['docx', 'jspdf', 'html2canvas'],
          // Spreadsheet import/export — only on Excel import
          'xlsx-vendor': ['xlsx'],
          // Drag-and-drop — only on Form Builder
          'dnd-vendor': ['react-beautiful-dnd'],
          // Supabase client
          'supabase-vendor': ['@supabase/supabase-js'],
          // UI primitives
          'ui-vendor': ['lucide-react', 'date-fns', 'clsx', 'tailwind-merge'],
        },
      },
    },
    // Increase chunk size warning threshold (chunks are intentionally split)
    chunkSizeWarningLimit: 1000,
  },
}));
