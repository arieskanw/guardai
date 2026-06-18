/**
 * TanStack Start — Production server entry
 * Starts an HTTP server that imports the built server bundle
 * and handles requests via its `fetch()` handler.
 * Also serves static assets from dist/client/.
 */
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { resolve, dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Load .env file manually (no deps)
const __dirname_env = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = resolve(__dirname_env, ".env");
if (existsSync(ENV_PATH)) {
  const envContent = readFileSync(ENV_PATH, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key && !process.env[key]) {
      process.env[key] = value;
    }
  }
  console.log("📝 Loaded env vars from .env");
}

const PORT = parseInt(process.env.PORT || "3001", 10);
const HOST = process.env.HOST || "0.0.0.0";
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname);
const CLIENT_DIR = resolve(ROOT, "dist/client");

// MIME types for static files (asset extensions only)
const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json",
};

// Load the built server bundle
const { default: server } = await import(resolve(ROOT, "./dist/server/server.js"));

// Check if a path is a static asset (has a recognized extension)
function isStaticAsset(pathname) {
  const ext = extname(pathname).toLowerCase();
  return ext && MIME_TYPES[ext];
}

// Create HTTP server
const httpServer = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || `localhost:${PORT}`}`);
    const pathname = url.pathname;

    // === Serve static assets from dist/client/ ===
    if ((req.method === "GET" || req.method === "HEAD") && isStaticAsset(pathname)) {
      const filePath = join(CLIENT_DIR, pathname);
      
      if (existsSync(filePath)) {
        const stat = statSync(filePath);
        if (stat.isFile()) {
          const ext = extname(filePath).toLowerCase();
          const contentType = MIME_TYPES[ext];
          
          if (req.method === "HEAD") {
            res.writeHead(200, {
              "Content-Type": contentType,
              "Content-Length": stat.size,
              "Cache-Control": "public, max-age=31536000, immutable",
            });
            res.end();
            return;
          }

          const content = readFileSync(filePath);
          res.writeHead(200, {
            "Content-Type": contentType,
            "Content-Length": content.length,
            "Cache-Control": "public, max-age=31536000, immutable",
          });
          res.end(content);
          return;
        }
      }
    }

    // === Fall through to TanStack Start SSR handler ===
    // Read body for POST/PUT/PATCH
    let body = null;
    if (req.method !== "GET" && req.method !== "HEAD") {
      body = await new Promise((resolve) => {
        const chunks = [];
        req.on("data", (chunk) => chunks.push(chunk));
        req.on("end", () => resolve(Buffer.concat(chunks)));
      });
    }

    const request = new Request(url.toString(), {
      method: req.method,
      headers: new Headers(req.headers),
      body: body || undefined,
    });

    const response = await server.fetch(request, {}, {});
    res.writeHead(response.status, Object.fromEntries(response.headers.entries()));

    if (response.body) {
      const reader = response.body.getReader();
      const pump = async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
        res.end();
      };
      await pump();
    } else {
      const text = await response.text();
      res.end(text);
    }
  } catch (error) {
    console.error("Server error:", error);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Internal Server Error");
    }
  }
});

httpServer.listen(PORT, HOST, () => {
  console.log(`🚀 Production server running on http://${HOST}:${PORT}`);
  console.log(`🔗 https://guardai.codezy.id`);
});
