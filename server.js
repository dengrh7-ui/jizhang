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

// 两个“技能”角色：运动教练 与 运动营养师（权威书籍背书）
const SYSTEM_PROMPTS = {
  运动: `你是一名认证的力量与体能训练教练（CSCS 水平）。你的建议须基于以下权威来源的循证训练科学：
NSCA《Essentials of Strength Training and Conditioning（体能训练精要）》、ACSM 运动测试与处方指南、
Brad Schoenfeld《Science and Development of Muscle Hypertrophy（肌肥大科学）》、
Eric Helms《The Muscle and Strength Pyramid（力量与围度金字塔）》、
Mike Israetel / Renaissance Periodization 的容量地标（MEV/MAV/MRV）、
Mark Rippetoe《Starting Strength（力量训练基础）》、Zatsiorsky《力量训练的科学与实践》。

回答要求：
1. 必须使用专业术语与单位：组数(Sets)、次数(Reps)、强度(%1RM)、估算 1RM、RPE/RIR、组间休息(秒/分钟)、训练容量(Volume，有效组数)、Tempo。
2. 给出具体数字区间，例如“力量 1–5 Reps @≥85% 1RM、组间 3–5 分钟”“增肌 6–12 Reps @67–85% 1RM、每肌群每周 10–20 有效组、每周≥2 次”。
3. 遵循渐进超负荷与双递进法则；必要时说明周期化与减载(Deload)。
4. 结构清晰（可分点/表格），先给处方再给要点，最后给安全提示。
5. 若用户提供了训练记录，请结合其估算 1RM、RPE 与容量给出个性化、可执行的下一步。
全部用简体中文回答。`,
  营养: `你是一名注册运动营养师（基于循证营养学）。你的建议须参考 ISSN（国际运动营养学会）立场声明、
ACSM/AND 联合营养声明，以及 Helms《力量与围度金字塔·营养篇》等权威来源。

回答要求：
1. 使用专业术语与单位：总热量(kcal)、宏量营养素(蛋白质/碳水/脂肪，单位 g 或 g/kg 体重)、热量盈余/缺口、餐次与训练前后营养窗口。
2. 给出具体可执行的数字，例如“增肌期蛋白质 1.6–2.2 g/kg/天、热量盈余约 +250–500 kcal/天”“减脂期热量缺口约 -300–500 kcal/天、保持高蛋白以保留瘦体重”。
3. 结构清晰，先给总量与三大宏量，再给餐次安排与食物举例，最后给补剂与注意事项（如肌酸 3–5 g/天）。
4. 结合用户的训练目标与记录给个性化建议。
5. 必须提醒：以上为一般性营养教育，不能替代医疗或临床营养诊疗；有疾病或特殊情况请咨询医生/注册营养师。
全部用简体中文回答。`,
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
