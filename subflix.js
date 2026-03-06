/* ============================================================
   SUBFLIX — subflix.js  (proxy-aware version)
   Uses /proxy/en/... paths served by your Node.js server
   so the iframe is same-origin and DOM patching works fully.
   ============================================================ */

/* ── URL STORE ────────────────────────────────────────────
   Points to your local proxy routes, not onoflix directly.
   Change the BASE if your proxy runs on a different port/domain.
   ──────────────────────────────────────────────────────── */
var STREAM_URLS = (function () {
  // When running locally:  http://localhost:3000
  // When deployed:         https://yourdomain.com
  var BASE = "";   // empty = same origin (recommended)

  var routes = {
    N: BASE + "/proxy/en/netflix",
    P: BASE + "/proxy/en/prime-video",
    D: BASE + "/proxy/en/disney-plus",
    H: BASE + "/proxy/en/hulu",
    M: BASE + "/proxy/en/hbo-max",
    A: BASE + "/proxy/en/apple-tv-plus",
    R: BASE + "/proxy/en/paramount-plus"
  };

  return {
    get: function (key) {
      return routes[key] || null;
    }
  };
})();

/* ── STATE ───────────────────────────────────────────────── */
var selectionDismissed = false;

/* ── LAUNCH STREAM ───────────────────────────────────────── */
function launchStream(key, label) {
  var url = STREAM_URLS.get(key);
  if (!url) { console.warn("Unknown service key:", key); return; }

  var svcLabel = document.getElementById("svc-label");
  if (svcLabel) svcLabel.textContent = label;

  var iframeView = document.getElementById("iframe-view");
  if (iframeView) iframeView.classList.add("open");

  var loader = document.getElementById("iloader");
  if (loader) loader.classList.remove("gone");

  var frame = document.getElementById("stream-frame");
  if (!frame) return;
  frame.src = "about:blank";

  if (!selectionDismissed) {
    selectionDismissed = true;
    var sel = document.getElementById("selection-screen");
    if (sel) {
      sel.classList.add("fade-out");
      setTimeout(function () { sel.style.display = "none"; }, 700);
    }
  }

  setTimeout(function () { frame.src = url; }, 400);

  frame.onload = function () {
    // Now same-origin — patching will fully work
    patchFrame(frame);
    var ld = document.getElementById("iloader");
    if (ld) setTimeout(function () { ld.classList.add("gone"); }, 500);
  };
}

/* ── GO BACK ─────────────────────────────────────────────── */
function goBack() {
  var iframeView = document.getElementById("iframe-view");
  if (iframeView) iframeView.classList.remove("open");

  setTimeout(function () {
    var frame = document.getElementById("stream-frame");
    if (frame) frame.src = "about:blank";
  }, 300);

  var dash = document.getElementById("dashboard");
  if (dash) dash.classList.add("visible");
}

/* ── IFRAME CONTENT PATCH ────────────────────────────────────
   Since the proxy serves pages from the same origin, this
   now has FULL DOM access — replaces text, hides elements,
   injects persistent styles.
   ──────────────────────────────────────────────────────────── */
function patchFrame(frame) {
  try {
    var doc = frame.contentDocument || frame.contentWindow.document;
    if (!doc || !doc.body) return;

    replaceText(doc.body);
    hideElements(doc);
    injectOverrideStyles(doc);

    if (doc.title) {
      doc.title = doc.title.replace(/onoflix/gi, "Subflix");
    }

    // Keep patching dynamic content
    var observer = new MutationObserver(function () {
      replaceText(doc.body);
      hideElements(doc);
    });
    observer.observe(doc.body, {
      childList: true,
      subtree: true,
      characterData: true
    });

  } catch (e) {
    console.warn("patchFrame error:", e.message);
  }
}

function replaceText(root) {
  if (!root) return;

  var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
  var nodes = [];
  var node;
  while ((node = walker.nextNode())) { nodes.push(node); }

  nodes.forEach(function (n) {
    if (/onoflix/i.test(n.nodeValue)) {
      n.nodeValue = n.nodeValue.replace(/onoflix/gi, "Subflix");
    }
  });

  root.querySelectorAll("[alt],[title],[placeholder],[aria-label]").forEach(function (el) {
    ["alt", "title", "placeholder", "aria-label"].forEach(function (a) {
      var v = el.getAttribute(a);
      if (v && /onoflix/i.test(v)) {
        el.setAttribute(a, v.replace(/onoflix/gi, "Subflix"));
      }
    });
  });
}

function hideElements(doc) {
  var selectors = [
    'a[href*="discord"]',
    'a[href*="t.me"]',
    'a[href*="telegram"]',
    'a[href*="discord.gg"]',
    '[class*="discord" i]',
    '[class*="telegram" i]',
    '[id*="discord" i]',
    '[id*="telegram" i]',
    '[class*="back-btn" i]',
    '[class*="backBtn" i]',
    '[class*="back-button" i]',
    '[class*="BackButton" i]',
    '[class*="go-back" i]',
    '[class*="goBack" i]',
    'button.back',
    'a.back-link',
    '.btn-back',
    '.nav-back',
    '[aria-label="Go back"]',
    '[aria-label="Back"]',
    '[data-testid*="back" i]'
  ];

  selectors.forEach(function (sel) {
    try {
      doc.querySelectorAll(sel).forEach(function (el) {
        el.style.setProperty("display", "none", "important");
        el.setAttribute("aria-hidden", "true");
      });
    } catch (e) {}
  });
}

function injectOverrideStyles(doc) {
  if (doc.getElementById("_subflix_styles")) return;
  var st = doc.createElement("style");
  st.id = "_subflix_styles";
  st.textContent = [
    'a[href*="discord"], a[href*="t.me"], a[href*="telegram"],',
    '[class*="discord" i], [class*="telegram" i],',
    '[id*="discord" i], [id*="telegram" i],',
    '[class*="back-btn" i], [class*="backBtn" i],',
    '[class*="back-button" i], [class*="BackButton" i],',
    '[class*="go-back" i], [class*="goBack" i],',
    'button.back, .btn-back, .nav-back,',
    '[aria-label="Go back"], [aria-label="Back"],',
    '[data-testid*="back" i] {',
    '  display: none !important;',
    '  visibility: hidden !important;',
    '}'
  ].join("\n");
  try { doc.head.appendChild(st); } catch (e) {}
}

/* ── ANTI-INSPECTION ─────────────────────────────────────── */
document.addEventListener("contextmenu", function (e) { e.preventDefault(); });

document.addEventListener("keydown", function (e) {
  var k = e.key ? e.key.toUpperCase() : "";
  var blocked =
    e.key === "F12" ||
    (e.ctrlKey && e.shiftKey && (k === "I" || k === "J" || k === "C")) ||
    (e.ctrlKey && k === "U") ||
    (e.metaKey && e.altKey && (k === "I" || k === "J"));
  if (blocked) { e.preventDefault(); e.stopPropagation(); return false; }
}, true);

/* ── CARD DATA ───────────────────────────────────────────── */
var cardRows = {
  r1: [
    { t: "Neon Requiem",   g: "Drama",     p: "pa", s: "Netflix"    },
    { t: "The Last Relay", g: "Sci-Fi",    p: "pb", s: "HBO Max"    },
    { t: "Verdant",        g: "Nature Doc",p: "pc", s: "Apple TV+"  },
    { t: "Vortex Queen",   g: "Thriller",  p: "pd", s: "Prime"      },
    { t: "Embers",         g: "Romance",   p: "pe", s: "Hulu"       },
    { t: "Deep Protocol",  g: "Action",    p: "pf", s: "Netflix"    },
    { t: "Crimson Web",    g: "Horror",    p: "pg", s: "Paramount+" },
    { t: "Orbit Nine",     g: "Sci-Fi",    p: "ph", s: "Disney+"    }
  ],
  r2: [
    { t: "Silver Lining",  g: "Drama",    p: "pb", s: "HBO Max"    },
    { t: "The Mire",       g: "Mystery",  p: "pg", s: "Netflix"    },
    { t: "Zero Kelvin",    g: "Sci-Fi",   p: "ph", s: "Apple TV+"  },
    { t: "Hazel",          g: "Indie",    p: "pc", s: "Hulu"       },
    { t: "Fractured",      g: "Thriller", p: "pd", s: "Prime"      },
    { t: "Solar Wind",     g: "Action",   p: "pe", s: "Paramount+" },
    { t: "The Archivist",  g: "Mystery",  p: "pa", s: "Netflix"    },
    { t: "Nebula Road",    g: "Sci-Fi",   p: "pf", s: "Disney+"    }
  ],
  r3: [
    { t: "Project Hollow", g: "Horror",   p: "pg", s: "Paramount+" },
    { t: "Meridian",       g: "Drama",    p: "pc", s: "Apple TV+"  },
    { t: "Quantum Shore",  g: "Thriller", p: "pd", s: "Netflix"    },
    { t: "Dust & Iron",    g: "Western",  p: "pe", s: "Prime"      },
    { t: "Prisma",         g: "Fantasy",  p: "ph", s: "HBO Max"    },
    { t: "The Glass Gate", g: "Drama",    p: "pa", s: "Hulu"       },
    { t: "Iron Bloom",     g: "Action",   p: "pb", s: "Disney+"    },
    { t: "Echo Chamber",   g: "Sci-Fi",   p: "pf", s: "Paramount+" }
  ],
  r4: [
    { t: "A Quiet Shore",  g: "Drama",      p: "pc", s: "Apple TV+"  },
    { t: "The Remnant",    g: "War",        p: "pa", s: "Netflix"    },
    { t: "Parallel Bloom", g: "Romance",    p: "pd", s: "HBO Max"    },
    { t: "Kindred Earth",  g: "Nature",     p: "pf", s: "Prime"      },
    { t: "Hollow Crown",   g: "Historical", p: "ph", s: "Disney+"    },
    { t: "Sable",          g: "Noir",       p: "pg", s: "Paramount+" },
    { t: "Celestine",      g: "Drama",      p: "pe", s: "Hulu"       },
    { t: "First Light",    g: "Sci-Fi",     p: "pb", s: "Paramount+" }
  ]
};

function renderCards(rowId, data) {
  var container = document.getElementById(rowId);
  if (!container) return;
  data.forEach(function (m) {
    var article = document.createElement("article");
    article.className = "card";
    article.innerHTML =
      '<div class="card-art ' + m.p + '">' +
        '<span class="card-badge">' + m.s + '</span>' +
        '<div class="card-ov"><div class="card-play">&#9658;</div></div>' +
        '<div class="card-name">' + m.t +
          '<span class="card-genre">' + m.g + '</span>' +
        '</div>' +
      '</div>';
    container.appendChild(article);
  });
}

document.addEventListener("DOMContentLoaded", function () {
  renderCards("r1", cardRows.r1);
  renderCards("r2", cardRows.r2);
  renderCards("r3", cardRows.r3);
  renderCards("r4", cardRows.r4);
});
