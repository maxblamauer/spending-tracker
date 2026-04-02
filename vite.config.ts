import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
/** GitHub Pages project URL is /<repo-name>/ — keep in sync with the repo name (currently stevies-college-fund). */
const BASE_PROD = '/stevies-college-fund/'

/** Root-absolute favicon URLs so Safari/bookmarks work even when the page URL has no trailing slash. */
function injectBaseInIndexHtml(base: string): Plugin {
  return {
    name: 'inject-base-index-html',
    transformIndexHtml(html, ctx) {
      let result = html.replace(/__BASE__/g, base)
      // Production only: discourage caching index.html so users don’t keep old script hrefs after a deploy
      // (stale HTML + new assets → 404 on hashed /assets/* files).
      if (ctx.bundle) {
        result = result.replace(
          '<head>',
          '<head>\n    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />',
        )
      }
      return result
    },
  }
}

export default defineConfig((env) => {
  // Local dev at http://localhost:5173/ — production + `vite preview` still use GitHub Pages base.
  const base = env.command === 'build' || env.isPreview ? BASE_PROD : '/'

  return {
    base,
    server: {
      open: true,
    },
    plugins: [react(), injectBaseInIndexHtml(base)],
  }
})
