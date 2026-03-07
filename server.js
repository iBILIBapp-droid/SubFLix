/**
 * SUBFLIX REVERSE PROXY — server.js
 */

const express  = require("express");
const { createProxyMiddleware, responseInterceptor } = require("http-proxy-middleware");
const path     = require("path");
const fs       = require("fs");

const app      = express();
const PORT     = process.env.PORT || 3000;
const UPSTREAM = "https://onoflix.live";

/* ── Where are the front-end files? ─────────────────────────
   Checks for /public subfolder first, falls back to repo root
   ────────────────────────────────────────────────────────── */
const publicDir = fs.existsSync(path.join(__dirname, "public", "subflix.html"))
  ? path.join(__dirname, "public")
  : __dirname;

/* ── HTML rewriter ──────────────────────────────────────── */
function rewriteHTML(html) {
  return html
    .replace(/onoflix/gi, "Subflix")
    .replace(/https?:\/\/onoflix\.live/gi, "")
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

/* ── 1. Proxy middleware FIRST ──────────────────────────── */
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
        if (proxyRes.headers["location"]) {
          proxyRes.headers["location"] = proxyRes.headers["location"]
            .replace(/https?:\/\/onoflix\.live/gi, "/proxy");
        }
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

/* ── 2. Static files SECOND ─────────────────────────────── */
app.use(express.static(publicDir));

/* ── 3. Root route — explicitly serve subflix.html ──────── */
app.get("/", (req, res) => {
  res.sendFile(path.join(publicDir, "subflix.html"));
});

/* ── 4. Any other unknown route → subflix.html ──────────── */
app.use((req, res) => {
  const file = path.join(publicDir, "subflix.html");
  if (fs.existsSync(file)) {
    res.sendFile(file);
  } else {
    res.status(404).send("subflix.html not found in: " + publicDir);
  }
});

app.listen(PORT, () => {
  console.log("Subflix proxy running on port", PORT);
  console.log("Serving files from:", publicDir);
});
