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

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(CUSTOMERS_FILE)) {
    fs.writeFileSync(CUSTOMERS_FILE, "[]", "utf8");
  }
}

function readCustomers() {
  ensureDataDir();
  try {
    const raw = fs.readFileSync(CUSTOMERS_FILE, "utf8").trim() || "[]";
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCustomers(customers) {
  ensureDataDir();
  fs.writeFileSync(CUSTOMERS_FILE, JSON.stringify(customers, null, 2), "utf8");
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 5_000_000) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error("Invalid JSON payload"));
      }
    });
    req.on("error", reject);
  });
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    "Cache-Control": "no-store",
    ...headers
  });
  res.end(body);
}

function sendJson(res, status, payload) {
  send(res, status, JSON.stringify(payload), {
    "Content-Type": "application/json; charset=utf-8"
  });
}

function sendText(res, status, text) {
  send(res, status, text, {
    "Content-Type": "text/plain; charset=utf-8"
  });
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function isAdmin(req) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Basic ")) return false;
  const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  const divider = decoded.indexOf(":");
  const username = divider >= 0 ? decoded.slice(0, divider) : "";
  const password = divider >= 0 ? decoded.slice(divider + 1) : "";
  return safeEqual(username, ADMIN_USERNAME) && safeEqual(password, ADMIN_PASSWORD);
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

function nowText() {
  return new Date().toLocaleString("zh-CN", { hour12: false });
}

function customerId() {
  return `C-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;
}

function normalizeCustomer(input = {}) {
  const contactCard = input.contactCard && typeof input.contactCard === "object" ? input.contactCard : null;
  const contact = input.contact ?? contactCard?.contact ?? "";
  const topic = input.topic ?? contactCard?.topic ?? input.focus ?? input.question ?? "";
  const hasLead = Boolean(contact || contactCard?.contact || topic || input.question);

  return {
    id: input.id || customerId(),
    name: input.name || contactCard?.name || "未命名客户",
    company: input.company || "未知",
    contact,
    industry: input.industry || "未知",
    needType: input.needType || "前台咨询",
    focus: input.focus || topic || input.question || "前台咨询待整理",
    interest: input.interest || "清力技术 / 自超滑技术 / 空心杯电机",
    repeated: input.repeated || input.question || "待观察",
    depth: input.depth || "中等",
    stage: input.stage || (hasLead ? "已沟通" : "新线索"),
    risk: input.risk || "低",
    suggestion: input.suggestion || (hasLead ? "客户已提交资料或咨询，建议业务跟进。" : "客户尚未留资，可继续观察需求。"),
    note: input.note || input.other || "",
    highValue: Boolean(input.highValue || hasLead),
    createdAt: input.createdAt || nowText(),
    updatedAt: nowText(),
    source: input.source || "前台客服页",
    sessionId: input.sessionId || "",
    contactCard
  };
}

function upsertCustomer(input) {
  const customers = readCustomers();
  const incoming = normalizeCustomer(input);
  const index = customers.findIndex((item) => item.id === incoming.id);
  if (index >= 0) {
    customers[index] = {
      ...customers[index],
      ...incoming,
      createdAt: customers[index].createdAt || incoming.createdAt,
      updatedAt: nowText()
    };
    writeCustomers(customers);
    return customers[index];
  }
  customers.unshift(incoming);
  writeCustomers(customers);
  return incoming;
}

function applyBulkCustomers(list) {
  const customers = Array.isArray(list) ? list.map(normalizeCustomer) : [];
  writeCustomers(customers);
  return customers;
}

function sendFile(res, filePath) {
  const resolved = path.resolve(filePath);
  const relative = path.relative(PUBLIC_DIR, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative) || !fs.existsSync(resolved) || fs.statSync(resolved).isDirectory()) {
    sendJson(res, 404, { ok: false, message: "Not found" });
    return;
  }
  const contentType = MIME[path.extname(resolved).toLowerCase()] || "application/octet-stream";
  res.writeHead(200, {
    "Content-Type": contentType,
    "Cache-Control": "no-store"
  });
  fs.createReadStream(resolved).pipe(res);
}

function databaseSnapshot() {
  const customers = readCustomers();
  const stageCount = customers.reduce((acc, item) => {
    const stage = item.stage || "新线索";
    acc[stage] = (acc[stage] || 0) + 1;
    return acc;
  }, {});
  const riskCount = customers.reduce((acc, item) => {
    const risk = item.risk || "低";
    acc[risk] = (acc[risk] || 0) + 1;
    return acc;
  }, {});
  return {
    ok: true,
    generatedAt: nowText(),
    storage: {
      type: "server-json",
      file: path.relative(__dirname, CUSTOMERS_FILE).replace(/\\/g, "/")
    },
    counts: {
      customers: customers.length,
      highValue: customers.filter((item) => item.highValue).length
    },
    stageCount,
    riskCount,
    customers
  };
}

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/health") {
    sendJson(res, 200, {
      ok: true,
      service: "qingli-web-product",
      mode: "real-backend",
      time: nowText()
    });
    return;
  }

  const publicCustomer = url.pathname.match(/^\/api\/public\/customers\/([^/]+)$/);
  if (publicCustomer && req.method === "GET") {
    const id = decodeURIComponent(publicCustomer[1]);
    const customer = readCustomers().find((item) => item.id === id) || null;
    sendJson(res, customer ? 200 : 404, { ok: Boolean(customer), customer });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/customers") {
    if (!requireAdmin(req, res)) return;
    sendJson(res, 200, { ok: true, customers: readCustomers() });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/database") {
    if (!requireAdmin(req, res)) return;
    sendJson(res, 200, databaseSnapshot());
    return;
  }

  if (req.method === "PUT" && url.pathname === "/api/customers") {
    if (!requireAdmin(req, res)) return;
    const payload = await readJson(req);
    const customers = applyBulkCustomers(payload.customers);
    sendJson(res, 200, { ok: true, customers });
    return;
  }

  if (req.method === "DELETE" && url.pathname === "/api/customers") {
    if (!requireAdmin(req, res)) return;
    const ids = (url.searchParams.get("ids") || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    const customers = readCustomers().filter((item) => !ids.includes(item.id));
    writeCustomers(customers);
    sendJson(res, 200, { ok: true, deleted: ids, customers });
    return;
  }

  const customerMatch = url.pathname.match(/^\/api\/customers\/([^/]+)$/);
  if (customerMatch && (req.method === "POST" || req.method === "PUT")) {
    const id = decodeURIComponent(customerMatch[1]);
    const payload = await readJson(req);
    const customer = upsertCustomer({ ...payload, id });
    sendJson(res, 200, { ok: true, customer });
    return;
  }

  if (customerMatch && req.method === "GET") {
    if (!requireAdmin(req, res)) return;
    const id = decodeURIComponent(customerMatch[1]);
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

    const requested = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
    sendFile(res, path.join(PUBLIC_DIR, requested));
  } catch (error) {
    sendJson(res, 500, { ok: false, message: error.message });
  }
});

ensureDataDir();
server.listen(PORT, () => {
  console.log(`Qingli web product started: http://localhost:${PORT}`);
  console.log(`Frontend: http://localhost:${PORT}/`);
  console.log(`Admin: http://localhost:${PORT}/admin`);
});
