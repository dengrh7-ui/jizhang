/* ============================================================
   德训录 — 轻量后端（零依赖，Node 18+）
   职责：
   1) 托管静态文件（index.html / styles.css / app.js）
   2) 「搭子」社群：创建/加入小队、队长编辑当天训练计划、队员查看

   数据持久化到本目录下的 squads.json（纯文件，无需数据库）。

   运行：
     node server.js
   然后访问 http://localhost:8000（手机同 WiFi 访问 http://你的IP:8000）
   ============================================================ */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8000;
const DB_FILE = path.join(__dirname, 'squads.json');

/* ---------- 数据持久化 ---------- */
let db = { squads: {} };
try {
  if (fs.existsSync(DB_FILE)) db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
} catch (e) { console.warn('读取 squads.json 失败，使用空库', e.message); }
function persist() {
  try { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); }
  catch (e) { console.error('写入 squads.json 失败', e.message); }
}

/* ---------- 工具 ---------- */
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 去除易混字符
  let c;
  do { c = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join(''); }
  while (Object.values(db.squads).some(s => s.code === c));
  return c;
}
function clean(s) { return String(s == null ? '' : s).trim(); }
function isCaptain(squad, userId) { return squad && squad.captainId === userId; }
function isMember(squad, userId) { return squad && squad.members.some(m => m.id === userId); }

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) return handleApi(req, res);
  return serveStatic(req, res);
});

/* ---------- 静态文件 ---------- */
function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(__dirname, path.normalize(urlPath).replace(/^(\.\.[/\\])+/, ''));
  if (!filePath.startsWith(__dirname)) { res.writeHead(403); return res.end('Forbidden'); }
  if (path.basename(filePath) === 'squads.json') { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not Found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
}

/* ---------- API 路由 ---------- */
function handleApi(req, res) {
  if (req.method === 'GET' && req.url.startsWith('/api/squad/get')) {
    const u = new URL(req.url, 'http://x');
    const squad = db.squads[u.searchParams.get('id')];
    if (!squad) return json(res, 404, { error: '小队不存在' });
    return json(res, 200, { squad });
  }
  if (req.method !== 'POST') return json(res, 404, { error: '未知接口' });

  let body = '';
  req.on('data', c => { body += c; if (body.length > 1e6) req.destroy(); });
  req.on('end', () => {
    let p;
    try { p = JSON.parse(body || '{}'); } catch { return json(res, 400, { error: '请求格式错误' }); }
    const userId = clean(p.userId);
    const userName = clean(p.userName).slice(0, 20) || '队员';
    if (!userId) return json(res, 400, { error: '缺少用户标识' });

    if (req.url === '/api/squad/create') {
      const name = clean(p.name).slice(0, 30);
      if (!name) return json(res, 400, { error: '请填写小队名称' });
      const id = genId();
      const squad = {
        id, name, code: genCode(), captainId: userId,
        createdAt: new Date().toISOString(),
        members: [{ id: userId, name: userName }],
        plans: {},
      };
      db.squads[id] = squad; persist();
      return json(res, 200, { squad });
    }

    if (req.url === '/api/squad/join') {
      const code = clean(p.code).toUpperCase();
      const squad = Object.values(db.squads).find(s => s.code === code);
      if (!squad) return json(res, 404, { error: '邀请码无效' });
      if (squad.members.length >= 50) return json(res, 400, { error: '小队人数已满' });
      if (!isMember(squad, userId)) squad.members.push({ id: userId, name: userName });
      else { const m = squad.members.find(m => m.id === userId); if (m) m.name = userName; }
      persist();
      return json(res, 200, { squad });
    }

    if (req.url === '/api/squad/plan') {
      const squad = db.squads[clean(p.squadId)];
      if (!squad) return json(res, 404, { error: '小队不存在' });
      if (!isCaptain(squad, userId)) return json(res, 403, { error: '只有队长可以编辑训练计划' });
      const date = clean(p.date);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json(res, 400, { error: '日期无效' });
      const text = clean(p.text).slice(0, 4000);
      if (text) squad.plans[date] = { text, updatedBy: userName, updatedAt: new Date().toISOString() };
      else delete squad.plans[date];
      persist();
      return json(res, 200, { squad });
    }

    if (req.url === '/api/squad/leave') {
      const squad = db.squads[clean(p.squadId)];
      if (!squad) return json(res, 404, { error: '小队不存在' });
      squad.members = squad.members.filter(m => m.id !== userId);
      // 队长退出且仍有成员 → 移交给第一位成员
      if (squad.captainId === userId && squad.members.length) squad.captainId = squad.members[0].id;
      if (!squad.members.length) delete db.squads[squad.id];
      persist();
      return json(res, 200, { ok: true });
    }

    return json(res, 404, { error: '未知接口' });
  });
}

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

server.listen(PORT, () => {
  console.log(`德训录 已启动： http://localhost:${PORT}`);
  console.log('「搭子」社群需要本后端运行；记录/日历/统计等本地功能离线也可用。');
});
