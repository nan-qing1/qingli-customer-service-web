const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 8787);
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const SKILLS_DIR = path.join(path.dirname(__dirname), "skills");
const CUSTOMERS_FILE = path.join(DATA_DIR, "customers.json");
const KNOWLEDGE_DIR = path.join(DATA_DIR, "knowledge");
const KNOWLEDGE_INDEX_FILE = path.join(DATA_DIR, "knowledge.json");
const PLATFORMS_FILE = path.join(DATA_DIR, "platforms.json");
const PLATFORM_SESSIONS_FILE = path.join(DATA_DIR, "platform-sessions.json");
const PLATFORM_LOGS_FILE = path.join(DATA_DIR, "platform-logs.json");

const DEFAULT_SKILL_ORDER = [
  "qingli-database-maintain",
  "qingli-knowledge-file-manager",
  "qingli-agent-router",
  "qingli-unified-inbox",
  "qingli-platform-sync",
  "qingli-platform-adapter",
  "qingli-platform-policy"
];

const SKILL_ROLE_MAP = new Map([
  ["qingli-database-maintain", { badge: "数据底座", note: "客户库、知识库、导入导出和去重回填" }],
  ["qingli-knowledge-file-manager", { badge: "知识底座", note: "知识文件、文档下载、分类和审核流" }],
  ["qingli-agent-router", { badge: "决策路由", note: "意图识别、风险判断和技能分流" }],
  ["qingli-unified-inbox", { badge: "会话工作台", note: "多平台会话汇总与客服协同" }],
  ["qingli-platform-sync", { badge: "同步层", note: "授权、webhook、轮询、重试和同步状态" }],
  ["qingli-platform-adapter", { badge: "适配层", note: "平台字段映射与统一消息结构" }],
  ["qingli-platform-policy", { badge: "规则层", note: "权限、自动回复限制与合规边界" }]
]);

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

const DEFAULT_PLATFORMS = [
  { id: "website", name: "官网网站", channel: "官网入口", status: "已接入", syncMode: "实时同步", entryUrl: "/", note: "官网咨询与留资" },
  { id: "xiaohongshu", name: "小红书", channel: "内容评论 / 私信", status: "待接入", syncMode: "人工转接", entryUrl: "https://www.xiaohongshu.com/", note: "笔记评论区统一收口" },
  { id: "douyin", name: "抖音", channel: "视频评论 / 私信", status: "待接入", syncMode: "Webhook 预留", entryUrl: "https://www.douyin.com/", note: "短视频入口统一承接" },
  { id: "bilibili", name: "Bilibili", channel: "视频评论 / 私信", status: "待接入", syncMode: "Webhook 预留", entryUrl: "https://www.bilibili.com/", note: "长视频内容咨询承接" },
  { id: "taobao", name: "淘宝", channel: "店铺客服", status: "待接入", syncMode: "接口预留", entryUrl: "https://www.taobao.com/", note: "交易咨询与售前答疑" },
  { id: "jd", name: "京东", channel: "店铺客服", status: "待接入", syncMode: "接口预留", entryUrl: "https://www.jd.com/", note: "商品咨询与售后转接" },
  { id: "kuaishou", name: "快手", channel: "视频评论 / 私信", status: "待接入", syncMode: "Webhook 预留", entryUrl: "https://www.kuaishou.com/", note: "短视频咨询统一收口" }
];

const DEFAULT_PLATFORM_SESSIONS = [
  {
    id: "P-1001",
    platformId: "website",
    platformName: "官网网站",
    customerId: "C-1001",
    customerName: "王女士",
    title: "空心杯电机适配咨询",
    status: "待跟进",
    unread: 1,
    lastMessageAt: "2026-07-19 15:20",
    summary: "询问寿命、发热和维护成本",
    messages: [
      { id: "M-1001", direction: "customer", text: "想了解空心杯电机寿命和灵巧手适配。", at: "2026-07-19 15:18", author: "王女士" },
      { id: "M-1002", direction: "agent", text: "已收到，我先为您整理相关资料。", at: "2026-07-19 15:20", author: "统一 Agent" }
    ]
  },
  {
    id: "P-1002",
    platformId: "douyin",
    platformName: "抖音",
    customerId: "C-1002",
    customerName: "李先生",
    title: "自超滑 MEMS 射频开关合作咨询",
    status: "待人工",
    unread: 2,
    lastMessageAt: "2026-07-19 17:10",
    summary: "关注合作模式、量产与资料范围",
    messages: [
      { id: "M-1003", direction: "customer", text: "短视频里提到的自超滑技术可以用于射频开关吗？", at: "2026-07-19 17:02", author: "李先生" },
      { id: "M-1004", direction: "agent", text: "可以先结合公开资料和应用场景进行说明，具体合作请转人工确认。", at: "2026-07-19 17:10", author: "统一 Agent" }
    ]
  },
  {
    id: "P-1003",
    platformId: "bilibili",
    platformName: "Bilibili",
    customerId: "C-1003",
    customerName: "未命名客户",
    title: "资料索取与技术方向",
    status: "待处理",
    unread: 1,
    lastMessageAt: "2026-07-19 18:30",
    summary: "希望了解自超滑技术、空心杯电机与灵巧手",
    messages: [
      { id: "M-1005", direction: "customer", text: "能否发一些自超滑技术的资料？", at: "2026-07-19 18:30", author: "访客" }
    ]
  }
];

const DEFAULT_PLATFORM_LOGS = [
  { id: "PL-1001", platformId: "website", level: "success", text: "官网入口会话已进入统一工作台。", at: "2026-07-19 15:20" },
  { id: "PL-1002", platformId: "douyin", level: "warn", text: "抖音平台处于待接入状态，消息先进入人工收口队列。", at: "2026-07-19 17:10" },
  { id: "PL-1003", platformId: "bilibili", level: "info", text: "Bilibili 会话已生成，等待平台授权接入。", at: "2026-07-19 18:30" }
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
  repairCustomersFile();
  ensureKnowledgeStore();
  ensurePlatformStore();
}

function safeFileName(name) {
  return String(name || "knowledge.txt")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120) || "knowledge.txt";
}

function looksCorruptedText(value) {
  return /�|Ã|å|æ|ç|é|锛|銆|鑷|绌|娓|鐭|鏉|鍙|缁|寰|宸|鏈|鍓|瀹/.test(String(value || ""));
}

const CUSTOMER_DEFAULT_TEXT_FIXES = new Map([
  ["鏈懡鍚嶅鎴?", "未命名客户"],
  ["鏈煡", "未知"],
  ["鍓嶅彴鍜ㄨ", "前台咨询"],
  ["鍓嶅彴鍜ㄨ寰呮暣鐞?", "前台咨询待整理"],
  ["娓呭姏鎶€鏈?/ 鑷秴婊戞妧鏈?/ 绌哄績鏉數鏈?", "清力技术 / 自超滑技术 / 空心杯电机"],
  ["寰呰瀵?", "待观察"],
  ["涓瓑", "中等"],
  ["宸叉矡閫?", "已沟通"],
  ["鏂扮嚎绱?", "新线索"],
  ["浣?", "低"],
  ["鍓嶅彴瀹㈡湇椤?", "前台客服页"]
]);

function repairKnownDefaultText(value) {
  if (typeof value !== "string") return value;
  return CUSTOMER_DEFAULT_TEXT_FIXES.get(value) || value;
}

function repairCustomerRecord(customer) {
  if (!customer || typeof customer !== "object") return customer;
  const repaired = { ...customer };
  ["name", "company", "industry", "needType", "focus", "interest", "repeated", "depth", "stage", "risk", "source"].forEach((key) => {
    repaired[key] = repairKnownDefaultText(repaired[key]);
  });
  if (repaired.contactCard && typeof repaired.contactCard === "object") {
    repaired.contactCard = { ...repaired.contactCard };
    Object.keys(repaired.contactCard).forEach((key) => {
      repaired.contactCard[key] = repairKnownDefaultText(repaired.contactCard[key]);
    });
  }
  return repaired;
}

function repairCustomersFile() {
  if (!fs.existsSync(CUSTOMERS_FILE)) return;
  try {
    const raw = fs.readFileSync(CUSTOMERS_FILE, "utf8").trim() || "[]";
    const customers = JSON.parse(raw);
    if (!Array.isArray(customers)) return;
    const repaired = customers.map(repairCustomerRecord);
    if (JSON.stringify(repaired) !== JSON.stringify(customers)) {
      fs.writeFileSync(CUSTOMERS_FILE, JSON.stringify(repaired, null, 2), "utf8");
    }
  } catch {
    // Keep the original file if it is not valid JSON; the admin can export and inspect it manually.
  }
}

function defaultKnowledgeRecord(item, existing = {}) {
  const fileName = safeFileName(item.fileName);
  return {
    ...existing,
    id: item.id,
    title: item.title,
    category: item.category,
    source: item.source,
    fileName,
    status: looksCorruptedText(existing.status) ? "已发布" : (existing.status || "已发布"),
    version: existing.version || "v1.0",
    createdAt: existing.createdAt || nowText(),
    updatedAt: nowText()
  };
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
    const fileName = safeFileName(item.fileName);
    const filePath = path.join(KNOWLEDGE_DIR, fileName);
    const index = items.findIndex((entry) => entry.id === item.id);
    const existing = index >= 0 ? items[index] : null;
    const existingText = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
    const shouldRepair = !existing
      || looksCorruptedText(existing.title)
      || looksCorruptedText(existing.category)
      || looksCorruptedText(existing.fileName)
      || looksCorruptedText(existing.status)
      || !fs.existsSync(filePath)
      || looksCorruptedText(existingText);

    if (!shouldRepair) return;

    fs.writeFileSync(filePath, item.content, "utf8");
    const record = defaultKnowledgeRecord(item, existing || {});
    if (index >= 0) items[index] = record;
    else items.push(record);
    changed = true;
  });
  if (changed) writeKnowledge(items);
}

function readJsonArrayFile(filePath, fallback = []) {
  if (!fs.existsSync(filePath)) return [...fallback];
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8") || "[]");
    return Array.isArray(parsed) ? parsed : [...fallback];
  } catch {
    return [...fallback];
  }
}

function writeJsonArrayFile(filePath, items) {
  fs.writeFileSync(filePath, JSON.stringify(Array.isArray(items) ? items : [], null, 2), "utf8");
}

function platformNameById(platformId) {
  const found = DEFAULT_PLATFORMS.find((item) => item.id === platformId);
  return found ? found.name : platformId || "未命名平台";
}

function normalizePlatform(platform = {}) {
  const id = String(platform.id || platform.platformId || "").trim() || `platform-${Date.now().toString().slice(-6)}`;
  const name = String(platform.name || platform.platformName || "").trim() || platformNameById(id);
  return {
    id,
    name,
    channel: String(platform.channel || "").trim() || "统一接入",
    status: String(platform.status || "").trim() || "待接入",
    syncMode: String(platform.syncMode || "").trim() || "人工转接",
    entryUrl: String(platform.entryUrl || "").trim() || "",
    note: String(platform.note || "").trim() || "",
    createdAt: platform.createdAt || nowText(),
    updatedAt: nowText()
  };
}

function normalizePlatformMessage(message = {}) {
  return {
    id: String(message.id || "").trim() || `PM-${Date.now().toString().slice(-8)}`,
    direction: message.direction === "agent" ? "agent" : message.direction === "system" ? "system" : "customer",
    text: String(message.text || "").trim(),
    author: String(message.author || "").trim() || (message.direction === "agent" ? "统一 Agent" : "客户"),
    at: message.at || nowText()
  };
}

function normalizePlatformSession(session = {}) {
  const platformId = String(session.platformId || session.platform || "website").trim() || "website";
  const messages = Array.isArray(session.messages) ? session.messages.map(normalizePlatformMessage) : [];
  return {
    id: String(session.id || "").trim() || `S-${Date.now().toString().slice(-8)}`,
    platformId,
    platformName: String(session.platformName || "").trim() || platformNameById(platformId),
    customerId: String(session.customerId || "").trim() || "",
    customerName: String(session.customerName || "").trim() || "",
    title: String(session.title || "").trim() || "未命名会话",
    summary: String(session.summary || "").trim() || "",
    status: String(session.status || "").trim() || "待跟进",
    unread: Number(session.unread || 0),
    lastMessageAt: session.lastMessageAt || nowText(),
    updatedAt: nowText(),
    messages
  };
}

function normalizePlatformLog(log = {}) {
  return {
    id: String(log.id || "").trim() || `PL-${Date.now().toString().slice(-8)}`,
    platformId: String(log.platformId || "").trim() || "website",
    level: String(log.level || "").trim() || "info",
    text: String(log.text || "").trim(),
    at: log.at || nowText()
  };
}

function ensurePlatformStore() {
  if (!fs.existsSync(PLATFORMS_FILE)) {
    writeJsonArrayFile(PLATFORMS_FILE, DEFAULT_PLATFORMS.map(normalizePlatform));
  }
  if (!fs.existsSync(PLATFORM_SESSIONS_FILE)) {
    writeJsonArrayFile(PLATFORM_SESSIONS_FILE, DEFAULT_PLATFORM_SESSIONS.map(normalizePlatformSession));
  }
  if (!fs.existsSync(PLATFORM_LOGS_FILE)) {
    writeJsonArrayFile(PLATFORM_LOGS_FILE, DEFAULT_PLATFORM_LOGS.map(normalizePlatformLog));
  }

  const platforms = readPlatforms();
  if (!platforms.length) writeJsonArrayFile(PLATFORMS_FILE, DEFAULT_PLATFORMS.map(normalizePlatform));

  const sessions = readPlatformSessions();
  if (!sessions.length) writeJsonArrayFile(PLATFORM_SESSIONS_FILE, DEFAULT_PLATFORM_SESSIONS.map(normalizePlatformSession));

  const logs = readPlatformLogs();
  if (!logs.length) writeJsonArrayFile(PLATFORM_LOGS_FILE, DEFAULT_PLATFORM_LOGS.map(normalizePlatformLog));
}

function readPlatforms() {
  return readJsonArrayFile(PLATFORMS_FILE, DEFAULT_PLATFORMS).map(normalizePlatform);
}

function writePlatforms(platforms) {
  ensureDataDir();
  writeJsonArrayFile(PLATFORMS_FILE, (platforms || []).map(normalizePlatform));
}

function readPlatformSessions() {
  return readJsonArrayFile(PLATFORM_SESSIONS_FILE, DEFAULT_PLATFORM_SESSIONS).map(normalizePlatformSession);
}

function writePlatformSessions(sessions) {
  ensureDataDir();
  writeJsonArrayFile(PLATFORM_SESSIONS_FILE, (sessions || []).map(normalizePlatformSession));
}

function readPlatformLogs() {
  return readJsonArrayFile(PLATFORM_LOGS_FILE, DEFAULT_PLATFORM_LOGS).map(normalizePlatformLog);
}

function writePlatformLogs(logs) {
  ensureDataDir();
  writeJsonArrayFile(PLATFORM_LOGS_FILE, (logs || []).map(normalizePlatformLog));
}

function upsertPlatformSession(input = {}) {
  const sessions = readPlatformSessions();
  const incoming = normalizePlatformSession(input);
  const index = sessions.findIndex((item) => item.id === incoming.id);
  if (index >= 0) {
    sessions[index] = { ...sessions[index], ...incoming, updatedAt: nowText() };
  } else {
    sessions.unshift(incoming);
  }
  writePlatformSessions(sessions);
  return index >= 0 ? sessions[index] : incoming;
}

function appendPlatformMessage(sessionId, messageInput = {}) {
  const sessions = readPlatformSessions();
  const index = sessions.findIndex((item) => item.id === sessionId);
  if (index < 0) return null;
  const session = sessions[index];
  const message = normalizePlatformMessage(messageInput);
  session.messages = Array.isArray(session.messages) ? session.messages : [];
  session.messages.push(message);
  session.lastMessageAt = message.at;
  session.updatedAt = nowText();
  if (message.direction === "customer") {
    session.unread = Math.max(0, Number(session.unread || 0) + 1);
    if (session.status === "已处理") session.status = "待跟进";
  } else if (message.direction === "agent") {
    session.unread = 0;
    session.status = "已回复";
  }
  if (String(messageInput.summary || "").trim()) {
    session.summary = String(messageInput.summary).trim();
  }
  sessions[index] = normalizePlatformSession(session);
  writePlatformSessions(sessions);
  return sessions[index];
}

function addPlatformLog(input = {}) {
  const logs = readPlatformLogs();
  const entry = normalizePlatformLog(input);
  logs.unshift(entry);
  writePlatformLogs(logs);
  return entry;
}

function parseFrontmatter(text) {
  const match = String(text || "").match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const result = {};
  match[1].split(/\r?\n/).forEach((line) => {
    const pair = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!pair) return;
    let value = pair[2].trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    result[pair[1]] = value;
  });
  return result;
}

function parseOpenAiYaml(text) {
  const source = String(text || "");
  const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const get = (key) => {
    const regex = new RegExp(`^\\s*${escapeRegExp(key)}:\\s*"([^"]*)"\\s*$`, "m");
    const match = source.match(regex);
    return match ? match[1] : "";
  };
  return {
    display_name: get("display_name"),
    short_description: get("short_description"),
    default_prompt: get("default_prompt"),
    allow_implicit_invocation: /^\s*allow_implicit_invocation:\s*true\s*$/m.test(source)
  };
}

function skillOrderRank(name) {
  const index = DEFAULT_SKILL_ORDER.indexOf(name);
  return index >= 0 ? index : DEFAULT_SKILL_ORDER.length + 10;
}

function loadSkillRegistry() {
  if (!fs.existsSync(SKILLS_DIR)) return [];
  const dirs = fs
    .readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  return dirs
    .map((dirName) => {
      const skillDir = path.join(SKILLS_DIR, dirName);
      const skillPath = path.join(skillDir, "SKILL.md");
      const openaiPath = path.join(skillDir, "agents", "openai.yaml");
      if (!fs.existsSync(skillPath)) return null;
      const skillMd = fs.readFileSync(skillPath, "utf8");
      const frontmatter = parseFrontmatter(skillMd);
      const openai = fs.existsSync(openaiPath) ? parseOpenAiYaml(fs.readFileSync(openaiPath, "utf8")) : {};
      const role = SKILL_ROLE_MAP.get(dirName) || { badge: "扩展技能", note: "项目内扩展能力" };
      return {
        name: dirName,
        displayName: openai.display_name || frontmatter.name || dirName,
        shortDescription: openai.short_description || frontmatter.description || "",
        defaultPrompt: openai.default_prompt || "",
        allowImplicitInvocation: Boolean(openai.allow_implicit_invocation),
        description: frontmatter.description || "",
        badge: role.badge,
        note: role.note,
        order: skillOrderRank(dirName),
        path: `skills/${dirName}`
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
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
    return Array.isArray(parsed) ? parsed.map(repairCustomerRecord) : [];
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

function sendCorsJson(res, status, payload) {
  send(res, status, JSON.stringify(payload), {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,PUT,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
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
  const skills = loadSkillRegistry();
  const platforms = readPlatforms();
  const platformSessions = readPlatformSessions();
  const platformLogs = readPlatformLogs();
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
      knowledgeFiles: knowledgeFiles.length,
      skills: skills.length,
      platforms: platforms.length,
      platformSessions: platformSessions.length,
      platformLogs: platformLogs.length
    },
    stageCount,
    riskCount,
    customers,
    knowledgeFiles,
    skills,
    platforms,
    platformSessions,
    platformLogs
  };
}

function workbenchSnapshot() {
  return {
    ok: true,
    generatedAt: nowText(),
    platforms: readPlatforms(),
    sessions: readPlatformSessions(),
    logs: readPlatformLogs(),
    customers: readCustomers(),
    knowledge: knowledgeWithFiles()
  };
}

function applyWorkbenchSnapshot(payload = {}) {
  if (Array.isArray(payload.platforms)) {
    const platforms = payload.platforms.map(normalizePlatform);
    writePlatforms(platforms.length ? platforms : DEFAULT_PLATFORMS.map(normalizePlatform));
  }
  if (Array.isArray(payload.sessions)) {
    const sessions = payload.sessions.map(normalizePlatformSession);
    writePlatformSessions(sessions.length ? sessions : DEFAULT_PLATFORM_SESSIONS.map(normalizePlatformSession));
  }
  if (Array.isArray(payload.logs)) {
    const logs = payload.logs.map(normalizePlatformLog);
    writePlatformLogs(logs.length ? logs : DEFAULT_PLATFORM_LOGS.map(normalizePlatformLog));
  }
  if (Array.isArray(payload.customers)) {
    const customers = payload.customers.map(normalizeCustomer);
    writeCustomers(customers);
  }
  if (Array.isArray(payload.knowledge)) {
    const items = payload.knowledge.map((item) => ({
      id: String(item.id || "").trim() || `K-${Date.now().toString().slice(-8)}`,
      title: String(item.title || "").trim() || "未命名知识库资料",
      category: String(item.category || "").trim() || "未分类",
      source: String(item.source || "").trim() || "工作台同步",
      fileName: safeFileName(String(item.fileName || "").trim() || "knowledge.md"),
      status: String(item.status || "").trim() || "已发布",
      version: String(item.version || "").trim() || "v1.0",
      clean: String(item.clean || "").trim() || "",
      fileUrl: String(item.fileUrl || "").trim() || ""
    }));
    writeKnowledge(items);
  }
  return workbenchSnapshot();
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

  if (url.pathname === "/api/workbench-state" && req.method === "OPTIONS") {
    sendCorsJson(res, 204, "");
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/workbench-state") {
    sendCorsJson(res, 200, workbenchSnapshot());
    return;
  }

  if (req.method === "PUT" && url.pathname === "/api/workbench-state") {
    const payload = await readJson(req);
    sendCorsJson(res, 200, applyWorkbenchSnapshot(payload));
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

  if (req.method === "GET" && url.pathname === "/api/skills") {
    if (!requireAdmin(req, res)) return;
    const skills = loadSkillRegistry();
    sendJson(res, 200, {
      ok: true,
      generatedAt: nowText(),
      skills
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/platforms") {
    if (!requireAdmin(req, res)) return;
    sendJson(res, 200, { ok: true, platforms: readPlatforms() });
    return;
  }

  if (req.method === "PUT" && url.pathname === "/api/platforms") {
    if (!requireAdmin(req, res)) return;
    const payload = await readJson(req);
    const platforms = Array.isArray(payload.platforms) ? payload.platforms.map(normalizePlatform) : [];
    writePlatforms(platforms.length ? platforms : DEFAULT_PLATFORMS.map(normalizePlatform));
    sendJson(res, 200, { ok: true, platforms: readPlatforms() });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/platform-sessions") {
    if (!requireAdmin(req, res)) return;
    const platformId = url.searchParams.get("platformId") || "";
    const sessions = readPlatformSessions().filter((session) => !platformId || session.platformId === platformId);
    sendJson(res, 200, { ok: true, sessions });
    return;
  }

  if (req.method === "PUT" && url.pathname === "/api/platform-sessions") {
    if (!requireAdmin(req, res)) return;
    const payload = await readJson(req);
    const sessions = Array.isArray(payload.sessions) ? payload.sessions.map(normalizePlatformSession) : [];
    writePlatformSessions(sessions.length ? sessions : DEFAULT_PLATFORM_SESSIONS.map(normalizePlatformSession));
    sendJson(res, 200, { ok: true, sessions: readPlatformSessions() });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/platform-sessions") {
    if (!requireAdmin(req, res)) return;
    const payload = await readJson(req);
    const session = upsertPlatformSession(payload);
    if (payload.logText) {
      addPlatformLog({
        platformId: session.platformId,
        level: payload.logLevel || "info",
        text: String(payload.logText)
      });
    }
    sendJson(res, 200, { ok: true, session, sessions: readPlatformSessions() });
    return;
  }

  const platformSessionMessageMatch = url.pathname.match(/^\/api\/platform-sessions\/([^/]+)\/messages$/);
  if (platformSessionMessageMatch && req.method === "POST") {
    if (!requireAdmin(req, res)) return;
    const sessionId = decodeURIComponent(platformSessionMessageMatch[1]);
    const payload = await readJson(req);
    const session = appendPlatformMessage(sessionId, payload);
    if (!session) {
      sendJson(res, 404, { ok: false, message: "Platform session not found" });
      return;
    }
    if (payload.customer && typeof payload.customer === "object") {
      const customer = upsertCustomer({
        ...payload.customer,
        id: payload.customer.id || session.customerId || undefined,
        sessionId: session.id,
        source: payload.customer.source || session.platformName
      });
      session.customerId = customer.id;
      session.customerName = customer.name;
      upsertPlatformSession(session);
    }
    if (payload.logText) {
      addPlatformLog({
        platformId: session.platformId,
        level: payload.logLevel || "info",
        text: String(payload.logText)
      });
    }
    sendJson(res, 200, { ok: true, session });
    return;
  }

  const platformSessionMatch = url.pathname.match(/^\/api\/platform-sessions\/([^/]+)$/);
  if (platformSessionMatch && req.method === "GET") {
    if (!requireAdmin(req, res)) return;
    const id = decodeURIComponent(platformSessionMatch[1]);
    const session = readPlatformSessions().find((item) => item.id === id) || null;
    sendJson(res, session ? 200 : 404, { ok: Boolean(session), session });
    return;
  }

  if (platformSessionMatch && (req.method === "PUT" || req.method === "PATCH")) {
    if (!requireAdmin(req, res)) return;
    const id = decodeURIComponent(platformSessionMatch[1]);
    const payload = await readJson(req);
    const session = upsertPlatformSession({ ...payload, id });
    sendJson(res, 200, { ok: true, session, sessions: readPlatformSessions() });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/platform-logs") {
    if (!requireAdmin(req, res)) return;
    const platformId = url.searchParams.get("platformId") || "";
    const logs = readPlatformLogs().filter((log) => !platformId || log.platformId === platformId);
    sendJson(res, 200, { ok: true, logs });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/platform-logs") {
    if (!requireAdmin(req, res)) return;
    const payload = await readJson(req);
    const log = addPlatformLog(payload);
    sendJson(res, 200, { ok: true, log, logs: readPlatformLogs() });
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

    if (url.pathname === "/workbench" || url.pathname === "/workbench/") {
      if (!requireAdmin(req, res)) return;
      sendFile(res, path.join(PUBLIC_DIR, "platform-workbench.html"));
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
