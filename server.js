/**
 * SUBFLIX REVERSE PROXY — server.js
 * Serves front-end files from the same directory OR a /public subfolder.
 * Proxies onoflix, rewrites HTML, strips anti-iframe headers.
 */

const express  = require("express");
const { createProxyMiddleware, responseInterceptor } = require("http-proxy-middleware");
const path     = require("path");
const fs       = require("fs");

const app      = express();
const PORT     = process.env.PORT || 3000;
const UPSTREAM = "https://onoflix.live";

/* ── Detect where front-end files live ──────────────────────
   Works whether files are in the repo root or in /public
   ────────────────────────────────────────────────────────── */
const publicDir = fs.existsSync(path.join(__dirname, "public"))
  ? path.join(__dirname, "public")
  : __dirname;

console.log("Serving static files from:", publicDir);

/* ── HTML rewriter ──────────────────────────────────────── */
function rewriteHTML(html) {
  return html
    // Brand name replacements
    .replace(/onoflix/gi, "Subflix")

    // Rewrite absolute onoflix URLs to stay inside proxy
    .replace(/https?:\/\/onoflix\.live/gi, "")

    // Inject CSS to hide Discord, Telegram, back buttons
    .replace(
      /<\/head>/i,
      `<style>
        a[href*="discord"],a[href*="t.me"],a[href*="telegram"],
        a[href*="discord.gg"],[class*="discord" i],[class*="telegram" i],
        [id*="discord" i],[id*="telegram" i],
        [class*="back-btn" i],[class*="backBtn" i],[class*="back-button" i],
        [class*="BackButton" i],[class*="go-back" i],[class*="goBack" i],
        button.back,.btn-back,.nav-back,
        [aria-label="Go back"],[aria-label="Back"],
        [data-testid*="back" i]{display:none!important}
      </style></head>`
    );
}

/* ── Proxy: /proxy/* → onoflix.live ────────────────────── */
app.use(
  "/proxy",
  createProxyMiddleware({
    target: UPSTREAM,
    changeOrigin: true,
    pathRewrite: { "^/proxy": "" },
    selfHandleResponse: true,
    on: {
      proxyRes: responseInterceptor(async (responseBuffer, proxyRes) => {
        const ct = proxyRes.headers["content-type"] || "";
        if (ct.includes("text/html")) {
          return rewriteHTML(responseBuffer.toString("utf8"));
        }
        return responseBuffer;
      }),

      proxyRes(proxyRes) {
        // Fix redirect headers
        if (proxyRes.headers["location"]) {
          proxyRes.headers["location"] = proxyRes.headers["location"]
            .replace(/https?:\/\/onoflix\.live/gi, "/proxy");
        }
        // Strip anti-embedding headers
        delete proxyRes.headers["x-frame-options"];
        delete proxyRes.headers["content-security-policy"];
        delete proxyRes.headers["content-security-policy-report-only"];
        proxyRes.headers["access-control-allow-origin"] = "*";
      },

      error(err, req, res) {
        console.error("Proxy error:", err.message);
        res.status(502).send("Proxy error: " + err.message);
      }
    }
  })
);

/* ── Serve static front-end files ───────────────────────── */
app.use(express.static(publicDir));

/* ── Fallback: always serve subflix.html for any route ──── */
app.get("*", (req, res) => {
  const indexPath = path.join(publicDir, "subflix.html");
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send(
      "subflix.html not found. Make sure it's in the repo root or in a /public folder."
    );
  }
});

app.listen(PORT, () => {
  console.log(`Subflix running → http://localhost:${PORT}`);
});
