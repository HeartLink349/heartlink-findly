/*
 * No-dependency local preview server supporting all SPA routes of Don't Block Me.
 * Run: node preview-server.js
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const rootPrefix = `${root}${path.sep}`;
const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".lottie": "application/octet-stream",
  ".mp3": "audio/mpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
  ".webp": "image/webp",
  ".woff2": "font/woff2"
};

const spaRoutes = new Set([
  "",
  "index.html",
  "user/name",
  "user/creating",
  "user/share",
  "user/scoreboard",
  "user/scoreboard/answers",
  "contact",
  "find",
  "player/name",
  "player/playing",
  "player/completed"
]);

const rootAssetNames = new Set([
  "styles.css",
  "storage.js",
  "questions.js",
  "i18n.js",
  "audio.js",
  "app.js"
]);

function resolveStaticPath(normalized) {
  // Handle relative requests from nested SPA paths like /user/scoreboard/styles.css or /player/assets/...
  const assetsIdx = normalized.indexOf("assets/");
  if (assetsIdx > 0) return normalized.slice(assetsIdx);
  const baseName = path.posix.basename(normalized);
  if (rootAssetNames.has(baseName)) return baseName;
  return normalized;
}

const server = http.createServer((request, response) => {
  const requestPath = decodeURIComponent((request.url || "/").split("?")[0]);
  const normalized = requestPath.replace(/^\/+/, "").replace(/\/+$/, "");

  const isSpaRoute = spaRoutes.has(normalized);
  const relativePath = isSpaRoute ? "index.html" : resolveStaticPath(normalized);
  const filePath = path.resolve(root, relativePath);

  if (filePath !== root && !filePath.startsWith(rootPrefix)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      if (!path.extname(relativePath)) {
        fs.readFile(path.join(root, "index.html"), (indexErr, indexData) => {
          if (indexErr) {
            response.writeHead(404);
            response.end("Not found");
            return;
          }
          response.writeHead(404, {
            "Cache-Control": "no-store",
            "Content-Type": "text/html; charset=utf-8"
          });
          response.end(indexData);
        });
        return;
      }
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": types[path.extname(filePath).toLowerCase()] || "application/octet-stream"
    });
    response.end(data);
  });
});

const requestedPort = Number(process.env.PORT) || 5500;
function listen(port) {
  server.listen(port, "127.0.0.1", () => {
    console.log(`Preview running at http://127.0.0.1:${port}/`);
  });
}

server.on("error", (error) => {
  if (error.code === "EADDRINUSE" && !process.env.PORT && requestedPort === 5500) {
    listen(5501);
    return;
  }
  console.error(error.message);
  process.exitCode = 1;
});

listen(requestedPort);
