require("dotenv").config();
const express = require("express");
const path = require("path");
const crypto = require("crypto");
const { chromium } = require("playwright");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

function validDiskwalaUrl(value) {
  try {
    const u = new URL(value);
    return /(^|\.)diskwala\.com$/i.test(u.hostname) && u.protocol === "https:";
  } catch {
    return false;
  }
}

async function resolveWithConfiguredApi(url) {
  if (!process.env.DISKWALA_API_URL || !process.env.DISKWALA_API_KEY) return null;
  const response = await fetch(process.env.DISKWALA_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": process.env.DISKWALA_API_KEY,
      "Authorization": `Bearer ${process.env.DISKWALA_API_KEY}`
    },
    body: JSON.stringify({ url })
  });
  if (!response.ok) throw new Error(`DiskWala API returned HTTP ${response.status}`);
  return await response.json();
}

async function resolveWithBrowser(url) {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      userAgent: "Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36"
    });

    const candidates = new Set();
    page.on("response", r => {
      const u = r.url();
      if (/\.(mp4|mkv|webm|mov|m4v|zip|rar|7z|pdf|apk)(\?|$)/i.test(u)) candidates.add(u);
      if (/download|stream|media|video|file/i.test(u)) candidates.add(u);
    });

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(3500);

    const links = await page.locator("a,video,source").evaluateAll(els =>
      els.map(e => e.href || e.src || e.currentSrc).filter(Boolean)
    );
    links.forEach(x => candidates.add(x));

    const bodyText = await page.locator("body").innerText().catch(() => "");
    return {
      pageTitle: await page.title(),
      candidates: [...candidates].filter(Boolean).slice(0, 100),
      pageTextPreview: bodyText.slice(0, 1000)
    };
  } finally {
    await browser.close();
  }
}

app.post("/api/resolve", async (req, res) => {
  const url = String(req.body?.url || "").trim();
  if (!validDiskwalaUrl(url)) {
    return res.status(400).json({ ok: false, error: "Please enter a valid https://www.diskwala.com/... URL." });
  }

  try {
    let apiResult = null;
    try { apiResult = await resolveWithConfiguredApi(url); } catch (e) {
      console.warn("Configured DiskWala API failed:", e.message);
    }

    const browserResult = await resolveWithBrowser(url);

    const directLinks = [];
    const add = x => {
      if (typeof x === "string" && /^https?:\/\//i.test(x) && !directLinks.includes(x)) directLinks.push(x);
    };

    if (Array.isArray(apiResult)) apiResult.forEach(x => add(x.direct_link || x.download_url || x.url));
    if (apiResult?.data) {
      const arr = Array.isArray(apiResult.data) ? apiResult.data : [apiResult.data];
      arr.forEach(x => add(x.direct_link || x.download_url || x.url));
    }
    browserResult.candidates.forEach(add);

    res.json({
      ok: true,
      source: url,
      title: browserResult.pageTitle,
      directLinks,
      apiResult: apiResult || null,
      note: directLinks.length
        ? "A candidate direct/media URL was found. Test it before relying on it."
        : "No direct URL was exposed to the browser. The DiskWala page may require an app-specific download flow."
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// TeraBox OAuth scaffold. Credentials are intentionally server-side.
app.get("/api/terabox/status", (req, res) => {
  const configured = Boolean(
    process.env.TERABOX_CLIENT_ID &&
    process.env.TERABOX_CLIENT_SECRET &&
    process.env.TERABOX_PRIVATE_SECRET
  );
  res.json({
    configured,
    message: configured
      ? "TeraBox Open Platform credentials are configured."
      : "TeraBox Open Platform credentials are not configured yet."
  });
});

app.get("/oauth/terabox/start", (req, res) => {
  if (!process.env.TERABOX_CLIENT_ID) {
    return res.status(501).send("Configure TERABOX_CLIENT_ID first.");
  }
  const clientId = encodeURIComponent(process.env.TERABOX_CLIENT_ID);
  res.redirect(`https://www.terabox.com/wap/outside/login?clientId=${clientId}`);
});

app.get("/oauth/terabox/callback", (req, res) => {
  // Token exchange intentionally left server-side and credential-dependent.
  // The official Open Platform returns a one-time authorization code.
  const code = req.query.code;
  if (!code) return res.status(400).send("No authorization code was returned.");
  res.send("TeraBox authorization code received. Add the server-side token exchange before production use.");
});

app.get("*splat", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`DiskWala → TeraBox app running at http://localhost:${PORT}`);
});