const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 8787);
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const CUSTOMERS_FILE = path.join(DATA_DIR, "customers.json");
const KNOWLEDGE_DIR = path.join(DATA_DIR, "knowledge");
const KNOWLEDGE_INDEX_FILE = path.join(DATA_DIR, "knowledge.json");

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
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
};

const DEFAULT_KNOWLEDGE = [
  {
    id: "kb-official-site",
    title: "清力技术官网公开资料",
    category: "官网资料",
    source: "https://www.frictionx.com/",
    fileName: "清力技术官网公开资料.md",
    content: [
      "# 清力技术官网公开资料",
      "",
      "来源：https://www.frictionx.com/",
      "",
      "用途：作为公司简介、技术方向、自超滑技术其他应用、联系方式等对外回复的公开知识来源。",
      "",
      "要点：深圳清力技术有限公司围绕自超滑技术开展工程化应用；公开资料可用于介绍自超滑空心杯电机、MEMS 射频开关、微动发电机等方向。",
      "",
      "客服回答要求：AI 回答公司、技术和应用问题时，应优先依托本知识库文件内容；没有在知识库确认的信息，不主动编造。"
    ].join("\n")
  },
  {
    id: "kb-superlubricity-tech",
    title: "自超滑技术与空心杯电机 PPT 摘要",
    category: "技术资料",
    source: "零一暑校PPT - 自超滑技术与空心杯电机-20260713",
    fileName: "自超滑技术与空心杯电机PPT摘要.md",
    content: [
      "# 自超滑技术与空心杯电机 PPT 摘要",
      "",
      "自超滑技术：两固体表面无润滑剂接触并相对滑动时，呈现低摩擦、低磨损、近零摩擦等特征。它可被理解为机械运动领域接近“超导”的物理机制级根技术。",
      "",
      "空心杯电机：自超滑方案可用于提升微特电机的寿命、可靠性和效率，减轻摩擦、磨损、发热、维护成本等问题。资料中提到 6/8/10/12/16/22/28 mm 等产品平台方向。",
      "",
      "灵巧手与机器人：机器人和灵巧手的长期稳定运行不仅依赖算法，也依赖底层运动部件。摩擦磨损会影响寿命、控制稳定性、发热和维护成本，自超滑可作为关节、执行器、轴承、减速箱、指关节等部件的底层优化方向。",
      "",
      "其他应用：自超滑技术可拓展到 MEMS、射频开关、微动发电机、精密机电、精密制造、航空航天、脑机接口、可重构芯片等场景。",
      "",
      "客服回答要求：涉及具体参数、量产节奏、竞品对比时，应提示以公司最新审核资料为准。"
    ].join("\n")
  }
];

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(KNOWLEDGE_DIR)) {
    fs.mkdirSync(KNOWLEDGE_DIR, { recursive: true });
  }
  if (!fs.existsSync(CUSTOMERS_FILE)) {
    fs.writeFileSync(CUSTOMERS_FILE, "[]", "utf8");
  }
  ensureKnowledgeStore();
}

function safeFileName(name) {
  return String(name || "knowledge.txt")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120) || "knowledge.txt";
}

function ensureKnowledgeStore() {
  if (!fs.existsSync(KNOWLEDGE_INDEX_FILE)) {
    fs.writeFileSync(KNOWLEDGE_INDEX_FILE, "[]", "utf8");
  }
  let items = [];
  try {
    items = JSON.parse(fs.readFileSync(KNOWLEDGE_INDEX_FILE, "utf8") || "[]");
    if (!Array.isArray(items)) items = [];
  } catch {
    items = [];
  }
  let changed = false;
  DEFAULT_KNOWLEDGE.forEach((item) => {
    if (items.some((entry) => entry.id === item.id)) return;
    const fileName = safeFileName(item.fileName);
    fs.writeFileSync(path.join(KNOWLEDGE_DIR, fileName), item.content, "utf8");
    items.push({
      id: item.id,
      title: item.title,
      category: item.category,
      source: item.source,
      fileName,
      status: "已发布",
      version: "v1.0",
      createdAt: nowText(),
      updatedAt: nowText()
    });
    changed = true;
  });
  if (changed) writeKnowledge(items);
}

function readKnowledge() {
  ensureDataDir();
  try {
    const parsed = JSON.parse(fs.readFileSync(KNOWLEDGE_INDEX_FILE, "utf8") || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeKnowledge(items) {
  fs.writeFileSync(KNOWLEDGE_INDEX_FILE, JSON.stringify(items, null, 2), "utf8");
}

function knowledgeWithFiles() {
  return readKnowledge().map((item) => {
    const filePath = path.join(KNOWLEDGE_DIR, item.fileName || "");
    const stat = fs.existsSync(filePath) ? fs.statSync(filePath) : null;
    return {
      ...item,
      size: stat ? stat.size : 0,
      exists: Boolean(stat),
      downloadUrl: `/api/knowledge/${encodeURIComponent(item.id)}/download`
    };
  });
}

function createKnowledgeItem(input = {}) {
  ensureDataDir();
  const title = String(input.title || "").trim() || "未命名知识库资料";
  const category = String(input.category || "").trim() || "未分类";
  const source = String(input.source || "").trim() || "后台录入";
  const raw = String(input.raw || "").trim();
  const clean = String(input.clean || "").trim();
  const body = [
    `# ${title}`,
    "",
    `分类：${category}`,
    `来源：${source}`,
    `可见范围：${input.visibility || "待审核"}`,
    "",
    "## 结构化条目",
    clean || "待结构化清洗",
    "",
    "## 原始资料",
    raw || "暂无原始资料"
  ].join("\n");
  const ext = path.extname(String(input.fileName || "")).toLowerCase() || ".md";
  const fileName = safeFileName(`${title}${ext === ".txt" || ext === ".md" ? ext : ".md"}`);
  const id = input.id || `K-${Date.now().toString().slice(-8)}`;
  fs.writeFileSync(path.join(KNOWLEDGE_DIR, fileName), body, "utf8");
  const items = readKnowledge();
  const item = {
    id,
    title,
    category,
    source,
    fileName,
    status: input.status || "待审核",
    version: input.version || "v0.1",
    createdAt: input.createdAt || nowText(),
    updatedAt: nowText()
  };
  const index = items.findIndex((entry) => entry.id === id);
  if (index >= 0) items[index] = { ...items[index], ...item };
  else items.unshift(item);
  writeKnowledge(items);
  return item;
}

function readKnowledgeContent(item) {
  const filePath = path.join(KNOWLEDGE_DIR, safeFileName(item.fileName));
  if (!fs.existsSync(filePath)) return "";
  const ext = path.extname(filePath).toLowerCase();
  if (![".txt", ".md", ".csv", ".json"].includes(ext)) return "";
  return fs.readFileSync(filePath, "utf8");
}

function searchKnowledge(query = "") {
  const terms = String(query || "")
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);
  return knowledgeWithFiles()
    .map((item) => {
      const content = readKnowledgeContent(item);
      const haystack = `${item.title} ${item.category} ${item.source} ${content}`.toLowerCase();
      const score = terms.length ? terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0) : 1;
      return {
        ...item,
        score,
        excerpt: content.replace(/\s+/g, " ").slice(0, 500)
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
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

function sendKnowledgeFile(res, item) {
  const fileName = safeFileName(item.fileName);
  const resolved = path.resolve(KNOWLEDGE_DIR, fileName);
  const relative = path.relative(KNOWLEDGE_DIR, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative) || !fs.existsSync(resolved)) {
    sendJson(res, 404, { ok: false, message: "Knowledge file not found" });
    return;
  }
  const contentType = MIME[path.extname(resolved).toLowerCase()] || "application/octet-stream";
  res.writeHead(200, {
    "Content-Type": contentType,
    "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    "Cache-Control": "no-store"
  });
  fs.createReadStream(resolved).pipe(res);
}

function databaseSnapshot() {
  const customers = readCustomers();
  const knowledgeFiles = knowledgeWithFiles();
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
      highValue: customers.filter((item) => item.highValue).length,
      knowledgeFiles: knowledgeFiles.length
    },
    stageCount,
    riskCount,
    customers,
    knowledgeFiles
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

  if (req.method === "GET" && url.pathname === "/api/public/knowledge/search") {
    const q = url.searchParams.get("q") || "";
    sendJson(res, 200, {
      ok: true,
      query: q,
      instruction: "AI 回答客户问题时，应优先依据 results 中的知识库文件内容；没有检索依据时不要编造。",
      results: searchKnowledge(q)
    });
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

  if (req.method === "GET" && url.pathname === "/api/knowledge") {
    if (!requireAdmin(req, res)) return;
    sendJson(res, 200, { ok: true, files: knowledgeWithFiles() });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/knowledge") {
    if (!requireAdmin(req, res)) return;
    const payload = await readJson(req);
    const item = createKnowledgeItem(payload);
    sendJson(res, 200, { ok: true, item, files: knowledgeWithFiles() });
    return;
  }

  const knowledgeDownload = url.pathname.match(/^\/api\/knowledge\/([^/]+)\/download$/);
  if (knowledgeDownload && req.method === "GET") {
    if (!requireAdmin(req, res)) return;
    const id = decodeURIComponent(knowledgeDownload[1]);
    const item = readKnowledge().find((entry) => entry.id === id);
    if (!item) {
      sendJson(res, 404, { ok: false, message: "Knowledge item not found" });
      return;
    }
    sendKnowledgeFile(res, item);
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
