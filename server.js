const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = Number(process.env.PORT) || 4173;
const host = process.env.HOST || "0.0.0.0";
const dataDir = path.join(root, "data");
const dataFile = path.join(dataDir, "items.json");
const githubConfig = {
  owner: process.env.GITHUB_OWNER,
  repo: process.env.GITHUB_REPO,
  branch: process.env.GITHUB_BRANCH || "main",
  path: process.env.GITHUB_DATA_PATH || "data/items.json",
  token: process.env.GITHUB_TOKEN,
  committerName: process.env.GITHUB_COMMITTER_NAME || "Antique Toy Ledger",
  committerEmail: process.env.GITHUB_COMMITTER_EMAIL || "antique-toy-ledger@example.com"
};
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function readItems() {
  if (!fs.existsSync(dataFile)) return [];
  return JSON.parse(fs.readFileSync(dataFile, "utf8"));
}

function writeItems(items) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(dataFile, JSON.stringify(items, null, 2));
}

function githubSyncEnabled() {
  return Boolean(githubConfig.owner && githubConfig.repo && githubConfig.token);
}

function toBase64(value) {
  return Buffer.from(value, "utf8").toString("base64");
}

async function githubRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${githubConfig.token}`,
      "Content-Type": "application/json",
      "User-Agent": "antique-toy-ledger",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers || {})
    }
  });

  if (response.status === 404 && options.allowNotFound) return null;

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(data.message || `GitHub request failed with status ${response.status}`);
  }

  return data;
}

async function getGithubFileSha() {
  if (!githubSyncEnabled()) return null;

  const encodedPath = githubConfig.path
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  const url = `https://api.github.com/repos/${githubConfig.owner}/${githubConfig.repo}/contents/${encodedPath}?ref=${encodeURIComponent(githubConfig.branch)}`;
  const data = await githubRequest(url, { method: "GET", allowNotFound: true });
  return data && data.sha ? data.sha : null;
}

async function syncItemsToGithub(items) {
  if (!githubSyncEnabled()) {
    return { enabled: false };
  }

  const encodedPath = githubConfig.path
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  const url = `https://api.github.com/repos/${githubConfig.owner}/${githubConfig.repo}/contents/${encodedPath}`;
  const content = `${JSON.stringify(items, null, 2)}\n`;
  const sha = await getGithubFileSha();
  const body = {
    message: `Update antique toy ledger (${items.length} items)`,
    content: toBase64(content),
    branch: githubConfig.branch,
    committer: {
      name: githubConfig.committerName,
      email: githubConfig.committerEmail
    }
  };

  if (sha) body.sha = sha;

  const data = await githubRequest(url, {
    method: "PUT",
    body: JSON.stringify(body)
  });

  return {
    enabled: true,
    commitUrl: data.commit && data.commit.html_url ? data.commit.html_url : null
  };
}

const server = http.createServer((req, res) => {
  let pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);

  if (pathname === "/api/items" && req.method === "GET") {
    try {
      sendJson(res, 200, readItems());
    } catch {
      sendJson(res, 500, { error: "Could not read saved items." });
    }
    return;
  }

  if (pathname === "/api/items" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 15_000_000) req.destroy();
    });
    req.on("end", async () => {
      try {
        const nextItems = JSON.parse(body || "[]");
        if (!Array.isArray(nextItems)) {
          sendJson(res, 400, { error: "Expected an array of items." });
          return;
        }

        writeItems(nextItems);
        let github;
        try {
          github = await syncItemsToGithub(nextItems);
        } catch (githubError) {
          github = {
            enabled: githubSyncEnabled(),
            error: githubError.message || "GitHub sync failed."
          };
        }
        sendJson(res, 200, { ok: true, github });
      } catch (error) {
        sendJson(res, 400, { error: error.message || "Could not save items." });
      }
    });
    return;
  }

  if (pathname === "/") pathname = "/index.html";

  const filePath = path.join(root, pathname);
  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    res.writeHead(200, { "Content-Type": types[path.extname(filePath)] || "application/octet-stream" });
    res.end(content);
  });
});

server.listen(port, host, () => {
  console.log(`Antique Toy Ledger running at http://${host}:${port}`);
  if (githubSyncEnabled()) {
    console.log(`GitHub sync enabled for ${githubConfig.owner}/${githubConfig.repo}:${githubConfig.path}`);
  } else {
    console.log("GitHub sync disabled. Set GITHUB_OWNER, GITHUB_REPO, and GITHUB_TOKEN to enable it.");
  }
});
