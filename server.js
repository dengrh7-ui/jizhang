/* ============================================================
   德训录 — 轻量后端（零依赖，Node 18+）
   职责：
   1) 托管静态文件（index.html / styles.css / app.js）
   2) 提供 POST /api/coach，安全代理调用 Claude（API Key 仅存于后端环境变量）

   运行：
     export ANTHROPIC_API_KEY=sk-ant-xxx
     node server.js
   然后访问 http://localhost:8000
   ============================================================ */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8000;
const API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';

// 两个“技能”角色：运动教练 与 营养师
const SYSTEM_PROMPTS = {
  运动: `你是一名专业的力量与体能训练教练。基于科学的训练原则（渐进超负荷、训练容量、
恢复与周期化）给出建议。回答要具体、可执行：给出动作、组数、次数、组间休息和注意事项。
使用中文，条理清晰，避免空泛。如用户提供了训练记录，请结合其实际情况给出个性化建议。`,
  营养: `你是一名专业的运动营养师。基于循证营养学给出建议，涵盖热量、三大宏量营养素
（蛋白质/碳水/脂肪）、餐次安排与训练前后补给。回答要具体、可执行，给出大致克数或比例。
使用中文，条理清晰。提醒用户你不能替代医疗建议，特殊疾病情况应咨询医生。`,
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/coach') {
    return handleCoach(req, res);
  }
  return serveStatic(req, res);
});

/* ---------- 静态文件 ---------- */
function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  // 防止目录穿越
  const filePath = path.join(__dirname, path.normalize(urlPath).replace(/^(\.\.[/\\])+/, ''));
  if (!filePath.startsWith(__dirname)) { res.writeHead(403); return res.end('Forbidden'); }

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not Found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
}

/* ---------- Claude 代理 ---------- */
function handleCoach(req, res) {
  let body = '';
  req.on('data', c => { body += c; if (body.length > 1e6) req.destroy(); });
  req.on('end', async () => {
    if (!API_KEY) return json(res, 500, { error: '后端未配置 ANTHROPIC_API_KEY 环境变量' });
    let payload;
    try { payload = JSON.parse(body); } catch { return json(res, 400, { error: '请求格式错误' }); }

    const mode = payload.mode === '营养' ? '营养' : '运动';
    const message = (payload.message || '').toString().slice(0, 4000).trim();
    if (!message) return json(res, 400, { error: '请输入问题' });

    let userContent = message;
    if (payload.context) userContent += `\n\n【我的近期训练记录】\n${String(payload.context).slice(0, 3000)}`;

    try {
      const upstream = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 1024,
          system: SYSTEM_PROMPTS[mode],
          messages: [{ role: 'user', content: userContent }],
        }),
      });
      const result = await upstream.json();
      if (!upstream.ok) {
        return json(res, upstream.status, { error: result?.error?.message || '调用 Claude 失败' });
      }
      const text = (result.content || []).map(b => b.text || '').join('').trim();
      return json(res, 200, { text });
    } catch (e) {
      return json(res, 502, { error: '无法连接 Claude 服务：' + e.message });
    }
  });
}

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

server.listen(PORT, () => {
  console.log(`德训录 已启动： http://localhost:${PORT}`);
  if (!API_KEY) console.warn('⚠️  未检测到 ANTHROPIC_API_KEY，AI 助手将不可用（其余功能正常）。');
});
