const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const dns = require("node:dns").promises;
const net = require("node:net");
const path = require("node:path");

const app = express();
const PORT = process.env.PORT || 3000;

app.disable("x-powered-by");
app.use(helmet());
app.use(express.json({ limit: "8kb" }));
app.use(rateLimit({ windowMs: 60_000, limit: 30 }));
app.use(express.static(path.join(__dirname, "public")));

const KNOWN_SERVICES = [
  { match: /(^|\\.)lootlabs\\.gg$/i, name: "LootLabs" },
  { match: /(^|\\.)loot-link\\.com$/i, name: "LootLabs" },
  { match: /(^|\\.)sfl\\.gl$/i, name: "SFL.gl" },
  { match: /(^|\\.)linkvertise\\.com$/i, name: "Linkvertise" },
  { match: /(^|\\.)linkvertise\\.net$/i, name: "Linkvertise" }
];

function isPrivateIPv4(ip) {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  return p[0] === 0 || p[0] === 10 || p[0] === 127 ||
    (p[0] === 169 && p[1] === 254) ||
    (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
    (p[0] === 192 && p[1] === 168) ||
    (p[0] === 100 && p[1] >= 64 && p[1] <= 127) ||
    p[0] >= 224;
}
function isPrivateIPv6(ip) {
  const x = ip.toLowerCase();
  return x === "::" || x === "::1" || x.startsWith("fc") ||
    x.startsWith("fd") || x.startsWith("fe80:") || x.startsWith("::ffff:");
}
function isPublicAddress(ip) {
  const kind = net.isIP(ip);
  if (kind === 4) return !isPrivateIPv4(ip);
  if (kind === 6) return !isPrivateIPv6(ip);
  return false;
}
async function validatePublicUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { throw new Error("Masukkan URL yang valid."); }
  if (!["http:", "https:"].includes(u.protocol)) throw new Error("Hanya URL HTTP/HTTPS yang didukung.");
  if (u.username || u.password) throw new Error("URL yang berisi kredensial tidak diizinkan.");
  if (!u.hostname || u.hostname === "localhost" || u.hostname.endsWith(".localhost") ||
      u.hostname.endsWith(".local") || u.hostname.endsWith(".internal")) {
    throw new Error("Alamat lokal/internal tidak diizinkan.");
  }
  if (u.port && !["80", "443"].includes(u.port)) throw new Error("Port khusus tidak diizinkan.");
  const literalType = net.isIP(u.hostname);
  if (literalType) {
    if (!isPublicAddress(u.hostname)) throw new Error("Alamat IP privat tidak diizinkan.");
  } else {
    let records;
    try { records = await dns.lookup(u.hostname, { all: true, verbatim: true }); }
    catch { throw new Error("Domain tidak dapat ditemukan."); }
    if (!records.length || records.some(r => !isPublicAddress(r.address))) {
      throw new Error("Domain mengarah ke alamat nonpublik dan ditolak.");
    }
  }
  return u;
}

app.post("/api/resolve", async (req, res) => {
  const raw = typeof req.body?.url === "string" ? req.body.url.trim() : "";
  if (!raw || raw.length > 2048) return res.status(400).json({ error: "URL wajib diisi (maksimal 2048 karakter)." });

  try {
    const first = await validatePublicUrl(raw);
    const service = KNOWN_SERVICES.find(s => s.match.test(first.hostname));
    // Do not attempt to defeat ad tasks, CAPTCHA, login, tokens, or provider access controls.
    // For known monetized-link services, report support status rather than pretending to bypass.
    if (service) {
      return res.json({
        input: first.href,
        host: first.hostname,
        provider: service.name,
        status: "provider-flow-required",
        message: `${service.name} terdeteksi. Resolver ini tidak melewati tugas iklan atau proteksi layanan. Buka link aslinya atau gunakan API/metode resmi yang tersedia.`
      });
    }

    // Follow ordinary HTTP redirects with a small hop limit. Every hop is validated.
    let current = first;
    const chain = [current.href];
    for (let i = 0; i < 5; i++) {
      await validatePublicUrl(current.href);
      let response;
      try {
        response = await fetch(current.href, {
          method: "GET",
          redirect: "manual",
          signal: AbortSignal.timeout(7000),
          headers: { "User-Agent": "SafeLinkResolver/1.0", "Range": "bytes=0-0" }
        });
      } catch {
        return res.json({
          input: first.href, host: first.hostname, status: "could-not-check",
          chain, message: "Server tujuan tidak dapat diperiksa. Coba buka link langsung di browser."
        });
      }

      const location = response.headers.get("location");
      const status = response.status;
      try { await response.body?.cancel(); } catch {}

      if (![301, 302, 303, 307, 308].includes(status) || !location) {
        return res.json({
          input: first.href, host: first.hostname, status: "checked",
          httpStatus: status, finalUrl: current.href, chain,
          message: "Tidak ditemukan pengalihan HTTP lanjutan yang dapat diikuti."
        });
      }

      let next;
      try { next = new URL(location, current); }
      catch { throw new Error("Tujuan redirect tidak valid."); }
      await validatePublicUrl(next.href);
      current = next;
      chain.push(current.href);
    }

    return res.json({
      input: first.href, host: first.hostname, status: "hop-limit",
      finalUrl: current.href, chain,
      message: "Batas 5 pengalihan tercapai. Periksa tujuan akhir sebelum membukanya."
    });
  } catch (err) {
    return res.status(400).json({ error: err.message || "URL tidak dapat diproses." });
  }
});

app.get("/health", (_req, res) => res.json({ ok: true }));
app.listen(PORT, () => console.log(`Link Resolver running on port ${PORT}`));
