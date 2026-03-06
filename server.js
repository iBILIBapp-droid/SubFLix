/**
 * SUBFLIX REVERSE PROXY — server.js
 * Node.js + Express
 *
 * Fetches onoflix pages server-side, rewrites the HTML
 * (onoflix → Subflix, removes Discord/Telegram/back buttons),
 * then serves it from YOUR domain so the iframe is same-origin.
 *
 * Install:  npm install
 * Run:      node server.js
 * Visit:    http://localhost:3000
 */

const express    = require("express");
const { createProxyMiddleware, responseInterceptor } = require("http-proxy-middleware");
const path       = require("path");

const app  = express();
const PORT = process.env.PORT || 3000;

/* ── Target upstream ── */
const UPSTREAM = "https://onoflix.live";

/* ── Serve your Subflix front-end files ── */
// Put your subflix.html / subflix.css / subflix.js in a folder called "public"
app.use(express.static(path.join(__dirname, "public")));

/* ── HTML rewriter ── */
function rewriteHTML(html) {
  return html
    // Brand name
    .replace(/onoflix/gi, "Subflix")
    .replace(/Onoflix/g,  "Subflix")
    .replace(/ONOFLIX/g,  "SUBFLIX")

    // Hide Discord / Telegram / back buttons via injected <style>
    .replace(
      "</head>",
      `<style>
        /* ── Subflix injection ── */
        a[href*="discord"],
        a[href*="t.me"],
        a[href*="telegram"],
        a[href*="discord.gg"],
        [class*="discord" i],
        [class*="telegram" i],
        [id*="discord" i],
        [id*="telegram" i],
        [class*="back-btn" i],
        [class*="backBtn" i],
        [class*="back-button" i],
        [class*="BackButton" i],
        [class*="go-back" i],
        [class*="goBack" i],
        button.back, .btn-back, .nav-back,
        [aria-label="Go back"],
        [aria-label="Back"],
        [data-testid*="back" i] {
          display: none !important;
        }
      </style>
      </head>`
    )

    // Rewrite all internal links that point to onoflix.live
    // so they stay inside your proxy instead of breaking out
    .replace(/https?:\/\/onoflix\.live/gi, "");
}

/* ── Proxy middleware ── */
app.use(
  "/proxy",
  createProxyMiddleware({
    target:       UPSTREAM,
    changeOrigin: true,

    // Strip the /proxy prefix before forwarding
    pathRewrite: { "^/proxy": "" },

    // We need to intercept the response to rewrite it
    selfHandleResponse: true,

    on: {
      proxyRes: responseInterceptor(async (responseBuffer, proxyRes) => {
        const contentType = proxyRes.headers["content-type"] || "";

        // Only rewrite HTML responses
        if (contentType.includes("text/html")) {
          const html = responseBuffer.toString("utf8");
          return rewriteHTML(html);
        }

        // Pass everything else (images, JS, CSS) through unchanged
        return responseBuffer;
      }),

      // Fix redirect locations so they stay within the proxy
      proxyRes(proxyRes) {
        if (proxyRes.headers["location"]) {
          proxyRes.headers["location"] = proxyRes.headers["location"]
            .replace(/https?:\/\/onoflix\.live/gi, "/proxy");
        }

        // Remove headers that would block iframe embedding
        delete proxyRes.headers["x-frame-options"];
        delete proxyRes.headers["content-security-policy"];
        delete proxyRes.headers["content-security-policy-report-only"];

        // Allow all origins (so your front-end can iframe it)
        proxyRes.headers["access-control-allow-origin"] = "*";
      },

      error(err, req, res) {
        console.error("Proxy error:", err.message);
        res.status(502).send("Proxy error: " + err.message);
      }
    }
  })
);

/* ── Service route map ── */
// These match your launchStream() keys in subflix.js
// Update subflix.js to use /proxy/en/... paths instead of the onoflix URLs
const SERVICES = {
  netflix:    "/proxy/en/netflix",
  prime:      "/proxy/en/prime-video",
  disney:     "/proxy/en/disney-plus",
  hulu:       "/proxy/en/hulu",
  hbo:        "/proxy/en/hbo-max",
  apple:      "/proxy/en/apple-tv-plus",
  paramount:  "/proxy/en/paramount-plus",
};

// Optional: API endpoint so your front-end can request a proxied URL by key
app.get("/api/stream/:key", (req, res) => {
  const url = SERVICES[req.params.key];
  if (!url) return res.status(404).json({ error: "Unknown service" });
  res.json({ url });
});

app.listen(PORT, () => {
  console.log(`Subflix proxy running → http://localhost:${PORT}`);
});
