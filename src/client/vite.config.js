import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dashboard build migrated from Create-React-App to Vite (see issue #34).
//
// The Node server serves the compiled dashboard from `src/public`
// (see src/server/app.js: express.static(path.join(__dirname, '../public'))).
// CRA emitted into `build/` and then moved it to `../public`; Vite emits
// straight into `../public` (i.e. src/public) so the server path is unchanged
// and no server change is required.
export default defineConfig(({ mode }) => ({
  plugins: [react({ jsxRuntime: 'classic' })],

  // CRA's webpack loader parsed JSX inside `.js` files; Vite/esbuild does not
  // by default. The dashboard ships JSX in `.js` (no `.jsx` extension), so tell
  // esbuild to treat `.js` as JSX everywhere under src.
  esbuild: {
    loader: 'jsx',
    include: /src\/.*\.js$/,
    exclude: [],
  },
  optimizeDeps: {
    esbuildOptions: { loader: { '.js': 'jsx' } },
  },

  // CRA exposed `process.env.NODE_ENV` and `process.env.PUBLIC_URL`; the app
  // still reads them (src/serviceWorker.js). Map them to Vite equivalents so
  // the existing application code keeps working unchanged.
  define: {
    'process.env.NODE_ENV': JSON.stringify(mode),
    'process.env.PUBLIC_URL': JSON.stringify('/'),
  },

  // CRA's webpack config aliased the Node core module `crypto` to
  // `crypto-browserify`; src/utils.js uses crypto.createHash('md5'). Reproduce
  // that mapping so the browser bundle keeps the same behaviour.
  resolve: {
    alias: {
      crypto: 'crypto-browserify',
      stream: 'stream-browserify',
    },
  },

  server: {
    port: 3000,
  },

  build: {
    // Emit into the directory the server already serves (src/public).
    outDir: '../public',
    emptyOutDir: true,
    assetsInlineLimit: 4096,
  },

  // Vitest reuses this config for the client unit tests.
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.js'],
    include: ['src/**/*.test.{js,jsx}'],
    passWithNoTests: true,
  },
}));
