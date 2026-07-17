const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 8787);
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const CUSTOMERS_FILE = path.join(DATA_DIR, "customers.json");

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "qingli2026";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

function ensureData() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(CUSTOMERS_FILE)) fs.writeFileSync(CUSTOMERS_FILE, "[]", "utf8");
}

function readCustomers() {
  ensureData();
  try {
    const data = JSON.parse(fs.readFileSync(CUSTOMERS_FILE, "utf8") || "[]");
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function writeCustomers(customers) {
  ensureData();
  fs.writeFileSync(CUSTOMERS_FILE, JSON.stringify(customers, null, 2), "utf8");
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 5_000_000) {
        reject(new Error("请求体过大"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
  });
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(data));
}

function sendFile(res, filePath) {
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(PUBLIC_DIR) || !fs.existsSync(resolved) || fs.statSync(resolved).isDirectory()) {
    sendJson(res, 404, { ok: false, message: "Not found" });
    return;
  }
  res.writeHead(200, {
    "Content-Type": MIME[path.extname(resolved).toLowerCase()] || "application/octet-stream"
  });
  fs.createReadStream(resolved).pipe(res);
}

function timingSafeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function isAdmin(req) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Basic ")) return false;
  const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  const index = decoded.indexOf(":");
  const username = index >= 0 ? decoded.slice(0, index) : "";
  const password = index >= 0 ? decoded.slice(index + 1) : "";
  return timingSafeEqual(username, ADMIN_USERNAME) && timingSafeEqual(password, ADMIN_PASSWORD);
}

function requireAdmin(req, res) {
  if (isAdmin(req)) return true;
  res.writeHead(401, {
    "WWW-Authenticate": 'Basic realm="Qingli Admin"',
    "Content-Type": "text/plain; charset=utf-8"
  });
  res.end("需要后台账号登录");
  return false;
}

function now() {
  return new Date().toLocaleString("zh-CN", { hour12: false });
}

function normalizeCustomer(item) {
  return {
    id: item.id || `C-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`,
    name: item.name || item.contactCard?.name || "未命名客户",
    company: item.company || "未知",
    contact: item.contact || item.contactCard?.contact || "",
    industry: item.industry || "未知",
    needType: item.needType || "前台咨询",
    focus: item.focus || item.topic || item.question || item.contactCard?.topic || "前台咨询待整理",
    interest: item.interest || "清力技术 / 自超滑技术 / 空心杯电机",
    repeated: item.repeated || item.question || "待观察",
    depth: item.depth || "中等",
    stage: item.stage || (item.contact || item.contactCard?.contact ? "已沟通" : "新线索"),
    risk: item.risk || "低",
    suggestion: item.suggestion || (item.contact || item.contactCard?.contact ? "客户已主动提交资料卡，建议业务人员跟进。" : "客户已产生前台咨询，可继续观察需求。"),
    note: item.note || item.other || "",
    highValue: Boolean(item.highValue || item.contact || item.topic || item.contactCard?.contact),
    createdAt: item.createdAt || now(),
    updatedAt: now(),
    source: item.source || "前台客服页",
    sessionId: item.sessionId || "",
    contactCard: item.contactCard || null
  };
}

function upsertCustomer(input) {
  const customers = readCustomers();
  const next = normalizeCustomer(input);
  const index = customers.findIndex((item) => item.id === next.id);
  if (index >= 0) {
    customers[index] = {
      ...customers[index],
      ...next,
      createdAt: customers[index].createdAt || next.createdAt
    };
  } else {
    customers.unshift(next);
  }
  writeCustomers(customers);
  return index >= 0 ? customers[index] : customers[0];
}

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/health") {
    sendJson(res, 200, { ok: true, service: "qingli-web-product", time: now() });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/customers") {
    if (!requireAdmin(req, res)) return;
    sendJson(res, 200, { ok: true, customers: readCustomers() });
    return;
  }

  if (req.method === "PUT" && url.pathname === "/api/customers") {
    if (!requireAdmin(req, res)) return;
    const payload = await readJson(req);
    const customers = Array.isArray(payload.customers) ? payload.customers.map(normalizeCustomer) : [];
    writeCustomers(customers);
    sendJson(res, 200, { ok: true, customers });
    return;
  }

  if (req.method === "DELETE" && url.pathname === "/api/customers") {
    if (!requireAdmin(req, res)) return;
    const ids = (url.searchParams.get("ids") || "").split(",").map((id) => id.trim()).filter(Boolean);
    const customers = readCustomers().filter((item) => !ids.includes(item.id));
    writeCustomers(customers);
    sendJson(res, 200, { ok: true, deleted: ids, customers });
    return;
  }

  const match = url.pathname.match(/^\/api\/customers\/([^/]+)$/);
  if (match && (req.method === "POST" || req.method === "PUT")) {
    const id = decodeURIComponent(match[1]);
    const customer = upsertCustomer({ ...(await readJson(req)), id });
    sendJson(res, 200, { ok: true, customer });
    return;
  }

  if (match && req.method === "GET") {
    if (!requireAdmin(req, res)) return;
    const id = decodeURIComponent(match[1]);
    const customer = readCustomers().find((item) => item.id === id) || null;
    sendJson(res, customer ? 200 : 404, { ok: Boolean(customer), customer });
    return;
  }

  sendJson(res, 404, { ok: false, message: "API not found" });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  try {
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }

    if (url.pathname === "/" || url.pathname === "/index.html") {
      sendFile(res, path.join(PUBLIC_DIR, "index.html"));
      return;
    }

    if (url.pathname === "/admin" || url.pathname === "/admin/") {
      if (!requireAdmin(req, res)) return;
      sendFile(res, path.join(PUBLIC_DIR, "admin.html"));
      return;
    }

    sendFile(res, path.join(PUBLIC_DIR, decodeURIComponent(url.pathname.replace(/^\/+/, ""))));
  } catch (error) {
    sendJson(res, 500, { ok: false, message: error.message });
  }
});

ensureData();
server.listen(PORT, () => {
  console.log(`清力技术客服 Web 产品已启动：http://localhost:${PORT}`);
  console.log(`前端客服页：http://localhost:${PORT}/`);
  console.log(`后台管理页：http://localhost:${PORT}/admin`);
});
