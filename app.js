/* ============================================================
   德训录 — 本地存储 (localStorage) 单页应用
   数据结构：
   - programs: [{ id, name, goal, exercises: [string] }]
   - sessions: [{ id, programId, programName, goal, date,
                  exercises: [{ id, name, sets: [{weight, reps, rpe}] }] }]
   - tips: [{ id, title, category, content }]   // 用户自定义要点
   专业指标：RPE(自觉用力程度 6–10)、估算 1RM(Epley)、%1RM、RIR、组间休息
   ============================================================ */

const STORE_KEY = 'fitness-tracker-v1';

const DEFAULT_DATA = {
  programs: [
    { id: uid(), name: '胸部训练', goal: '增肌', exercises: ['杠铃卧推', '上斜哑铃卧推', '哑铃飞鸟', '绳索夹胸'] },
    { id: uid(), name: '腿部训练', goal: '增肌', exercises: ['杠铃深蹲', '罗马尼亚硬拉', '腿举', '腿屈伸', '坐姿提踵'] },
    { id: uid(), name: '背部训练', goal: '增肌', exercises: ['硬拉', '引体向上', '杠铃划船', '高位下拉'] },
    { id: uid(), name: '肩部训练', goal: '增肌', exercises: ['坐姿杠铃推举', '哑铃侧平举', '面拉', '反向飞鸟'] },
    { id: uid(), name: '手臂训练', goal: '增肌', exercises: ['杠铃弯举', '锤式弯举', '窄距卧推', '绳索下压'] },
    { id: uid(), name: '功能性训练', goal: '功能性', exercises: ['壶铃摆动', '农夫行走', '药球砸地', '雪橇推'] },
  ],
  sessions: [],
  tips: [],
};

/* ---------- 训练目标处方（基于 NSCA / ACSM / Schoenfeld） ---------- */
const GOAL_GUIDE = {
  力量: {
    reps: '1–5 Reps', intensity: '≥85% 1RM', sets: '每动作 3–6 组',
    rest: '组间休息 3–5 分钟', rir: 'RIR 1–2',
    note: '以多关节复合动作为主，强度优先、动作精准。— NSCA《体能训练精要》/ Rippetoe《力量训练基础》',
  },
  增肌: {
    reps: '6–12 Reps', intensity: '67–85% 1RM', sets: '每动作 3–6 组',
    rest: '复合 2–3 分钟 / 孤立 1–2 分钟', rir: 'RIR 0–3（接近力竭）',
    note: '每个肌群每周累计 10–20 个有效组，分至少 2 次练。— Schoenfeld《肌肥大科学》',
  },
  耐力: {
    reps: '≥15 Reps', intensity: '≤67% 1RM', sets: '每动作 2–3 组',
    rest: '组间休息 ≤30–60 秒', rir: 'RIR 0–1',
    note: '短间歇、高次数，发展肌耐力与代谢压力。— ACSM 运动测试与处方指南',
  },
  功能性: {
    reps: '5–15 Reps 或计时/计距', intensity: '中等负荷 / 自重 / 爆发力', sets: '每动作 3–5 组',
    rest: '组间休息 1–3 分钟', rir: '以动作质量与功率为先',
    note: '强调多平面、核心稳定与基础动作模式。— NSCA《体能训练精要》',
  },
};
const GOALS = Object.keys(GOAL_GUIDE);

/* ---------- 内置专业知识库（只读，权威书籍背书） ---------- */
const KNOWLEDGE = [
  { title: '按目标选择 Reps 与强度', category: '组数建议',
    content: '力量：1–5 Reps，≥85% 1RM，组间 3–5 分钟；\n增肌：6–12 Reps，67–85% 1RM，组间 1–3 分钟；\n耐力：≥15 Reps，≤67% 1RM，组间 ≤60 秒。强度(%1RM)与次数互为反比。',
    source: 'NSCA《体能训练精要(第4版)》· ACSM 运动指南' },
  { title: '每周每肌群训练容量（组数）', category: '组数建议',
    content: '以“有效组(接近力竭的工作组)”计：每个肌群每周约 10–20 组可获得良好增长。\nMEV(最低有效容量)≈8–10 组，MAV(最佳适应容量)≈12–18 组，MRV(最大可恢复容量)≈20+ 组，超过则恢复不足。',
    source: 'Schoenfeld 2017 Meta · Israetel(RP)《Scientific Principles of Hypertrophy》' },
  { title: '训练频率：每肌群每周 ≥2 次', category: '组数建议',
    content: '在周容量相同的前提下，把容量分散到每周 2 次以上训练，肌肥大效果优于每周 1 次。例如每肌群 16 组，拆成 2×8 优于 1×16。',
    source: 'Schoenfeld 2016 Meta-analysis（训练频率）' },
  { title: '渐进超负荷与双递进法则', category: '训练要点',
    content: '肌肉适应来自持续递增的刺激。推荐“双递进(Double Progression)”：先在固定重量下把次数做到目标区间上限（如 12 次），下次再加重并回到区间下限（如 8 次），如此循环。',
    source: 'Zatsiorsky《力量训练的科学与实践》· Helms《力量与围度金字塔》' },
  { title: 'RPE / RIR 自觉强度量表', category: '关键技巧',
    content: 'RPE(自觉用力程度) 6–10：\nRPE 10 = 力竭，0 次余力(RIR 0)；\nRPE 9 = 还剩 1 次(RIR 1)；\nRPE 8 = 还剩 2 次(RIR 2)。\n增肌多数工作组建议 RPE 7–9；力量大重量可达 RPE 8–9。',
    source: 'Zourdos 等 2016（基于 RIR 的 RPE 量表）' },
  { title: '接近力竭，但不必每组力竭', category: '训练要点',
    content: '把工作组练到“接近力竭”(RIR 0–3)即可有效刺激肌肉；长期每组绝对力竭会累积疲劳、影响容量与恢复。复合大重量动作尤其要保留 1–2 次余力以保安全。',
    source: 'Schoenfeld《肌肥大科学》· Helms《力量与围度金字塔》' },
  { title: '组间休息时长', category: '关键技巧',
    content: '力量(大重量复合)：3–5 分钟，保证神经与磷酸原系统恢复；\n增肌：复合 2–3 分钟、孤立 1–2 分钟，休息过短会牺牲后续组的总容量；\n耐力：≤30–60 秒。',
    source: 'Schoenfeld 2016（组间休息与增肌）· NSCA' },
  { title: '动作节奏(Tempo)与离心控制', category: '关键技巧',
    content: '用 2–4 秒控制离心(还原)阶段，向心(发力)有控制地加速；全程肌肉持续张力。避免靠惯性甩起重量。节奏记法如 3-1-1-0（离心-底部停顿-向心-顶部）。',
    source: 'Schoenfeld《肌肥大科学》· Siff《Supertraining》' },
  { title: '热身：渐进升重组(Ramp-up)', category: '训练要点',
    content: '正式组前先做 5–10 分钟全身热身，再用 40%/60%/80% 工作重量做 2–3 个升重组（次数递减），激活目标肌群、复习动作轨迹并降低受伤风险，且几乎不产生额外疲劳。',
    source: 'NSCA《体能训练精要》· Rippetoe《力量训练基础》' },
  { title: '估算 1RM（Epley 公式）', category: '关键技巧',
    content: '1RM ≈ 重量 ×(1 + 次数/30)。例：100kg×5 → 约 117kg。\n用次极限重量(reps≤10)估算更准，可避免频繁测真 1RM 带来的风险。本 App 会自动为每个动作计算估算 1RM 并追踪趋势。',
    source: 'Epley 1985 · Brzycki 公式可作交叉验证' },
  { title: '核心稳定与呼吸(瓦式呼吸)', category: '关键技巧',
    content: '大重量深蹲/硬拉/推举时，吸气后屏息收紧核心(Valsalva)以稳定脊柱、提升发力；完成最难一段后呼气。高血压或心血管风险者应谨慎使用并咨询医生。',
    source: 'Zatsiorsky《力量训练的科学与实践》· NSCA' },
  { title: '周期化：让进步可持续', category: '训练要点',
    content: '避免长期同一强度。可用线性或波动周期：如以 4–6 周为一个区块逐步加量，之后安排 1 周减载(Deload，容量/强度降至约 50–60%)以消除疲劳、实现超量恢复。',
    source: 'Zatsiorsky · Israetel(RP) 区块周期化' },
];

let data = load();
normalizeData();

// 兼容旧数据：补齐缺失字段
function normalizeData() {
  data.programs = data.programs || [];
  data.sessions = data.sessions || [];
  data.tips = data.tips || [];
  data.profile = data.profile || {};
  data.programs.forEach(p => { if (!p.goal) p.goal = '增肌'; });
}

/* ---------- 工具函数 ---------- */
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { console.warn('读取存储失败', e); }
  return JSON.parse(JSON.stringify(DEFAULT_DATA));
}
function save() { localStorage.setItem(STORE_KEY, JSON.stringify(data)); }
function todayStr() { return new Date().toISOString().slice(0, 10); }
function esc(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------- 专业计算 ---------- */
// 估算 1RM（Epley 公式）：1RM = w × (1 + reps/30)
function est1RM(w, r) {
  w = Number(w) || 0; r = Number(r) || 0;
  if (w <= 0 || r <= 0) return 0;
  if (r === 1) return w;
  return w * (1 + r / 30);
}
// 估算 1RM（Brzycki 公式），用于交叉验证
function est1RM_brzycki(w, r) {
  w = Number(w) || 0; r = Number(r) || 0;
  if (w <= 0 || r <= 0 || r >= 37) return 0;
  return w * 36 / (37 - r);
}
function round1(n) { return Math.round(n * 10) / 10; }
function roundHalf(n) { return Math.round(n * 2) / 2; }

// 取一个动作里“估算 1RM 最高”的一组
function bestSetByE1RM(sets) {
  let best = null;
  (sets || []).forEach(set => {
    const e = est1RM(set.weight, set.reps);
    if (e > 0 && (!best || e > best.e1rm)) {
      best = { w: Number(set.weight) || 0, r: Number(set.reps) || 0, rpe: set.rpe || '', e1rm: e };
    }
  });
  return best;
}

// 判断是否为孤立/小肌群动作（用于渐进超负荷的加重幅度）
function isIsolation(name) {
  return /(飞鸟|侧平举|前平举|后束|弯举|下压|腿屈伸|腿弯举|提踵|夹胸|夹|面拉|耸肩|卷腹|臂屈伸|绳索|反向飞鸟)/.test(name);
}

/* ---------- 选项卡切换（按需渲染，加快首屏打开） ---------- */
const tabRendered = {};
function renderTab(tab) {
  if (tab === 'calendar') renderCalendar();
  else if (tab === 'diet') renderDiet();
  else if (tab === 'tips') { renderAnatomy(); renderTips(); }
  else if (tab === 'stats') renderStats();
  else if (tab === 'squad') renderSquad();
  tabRendered[tab] = true;
}
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + tab).classList.add('active');
    renderTab(tab);   // 切到哪个就渲染哪个（搭子等始终拉取最新）
  });
});

/* ============================================================
   训练项目 (Programs)
   ============================================================ */
function renderPrograms() {
  // 填充记录页的下拉选择
  const sel = document.getElementById('session-program');
  sel.innerHTML = data.programs.length
    ? data.programs.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')
    : '<option value="">请先创建训练项目</option>';

  const list = document.getElementById('programs-list');
  if (!data.programs.length) {
    list.innerHTML = '<div class="empty">还没有训练项目，添加一个开始吧。</div>';
    return;
  }
  list.innerHTML = data.programs.map(p => {
    const g = GOAL_GUIDE[p.goal] || null;
    return `
    <div class="program-item">
      <div class="head">
        <div>
          <div class="name">${esc(p.name)}${p.goal ? `<span class="goal-tag">${esc(p.goal)}</span>` : ''}</div>
          <div class="ex-list">${p.exercises.length ? esc(p.exercises.join(' · ')) : '（暂无预设动作）'}</div>
        </div>
        <button class="btn small danger" data-del-program="${p.id}">删除</button>
      </div>
      ${g ? `<div class="goal-guide">
        <span><b>${g.reps}</b></span><span>${g.intensity}</span><span>${g.sets}</span>
        <span>${g.rest}</span><span>${g.rir}</span>
        <div class="guide-note">${esc(g.note)}</div>
      </div>` : ''}
    </div>`;
  }).join('');

  list.querySelectorAll('[data-del-program]').forEach(b => {
    b.addEventListener('click', () => {
      if (confirm('确定删除该训练项目？已有记录不受影响。')) {
        data.programs = data.programs.filter(p => p.id !== b.dataset.delProgram);
        save(); renderPrograms();
      }
    });
  });
}

// 填充“训练目标”下拉
function fillGoalSelect() {
  const sel = document.getElementById('program-goal');
  sel.innerHTML = GOALS.map(g => `<option value="${g}"${g === '增肌' ? ' selected' : ''}>${g}</option>`).join('');
}

document.getElementById('add-program').addEventListener('click', () => {
  const name = document.getElementById('program-name').value.trim();
  if (!name) { alert('请输入项目名称'); return; }
  const goal = document.getElementById('program-goal').value || '增肌';
  const exercises = document.getElementById('program-exercises').value
    .split(/[,，]/).map(s => s.trim()).filter(Boolean);
  data.programs.push({ id: uid(), name, goal, exercises });
  save();
  document.getElementById('program-name').value = '';
  document.getElementById('program-exercises').value = '';
  renderPrograms();
});

/* ============================================================
   训练记录 (Sessions)
   ============================================================ */
document.getElementById('start-session').addEventListener('click', () => {
  const programId = document.getElementById('session-program').value;
  const date = document.getElementById('session-date').value || todayStr();
  if (!programId) { alert('请先在“训练项目”中创建项目'); return; }
  const program = data.programs.find(p => p.id === programId);
  data.sessions.unshift({
    id: uid(),
    programId,
    programName: program ? program.name : '训练',
    goal: program ? program.goal : '',
    date,
    // 预填该项目的动作，便于直接记录组数
    exercises: program
      ? program.exercises.map(name => ({ id: uid(), name, sets: [] }))
      : [],
  });
  save();
  renderSessions();
});

let historyFilter = '全部';

// 填充训练历史的分类筛选下拉
function fillHistoryFilter() {
  const sel = document.getElementById('history-filter');
  const names = [...new Set(data.sessions.map(s => s.programName))];
  if (historyFilter !== '全部' && !names.includes(historyFilter)) historyFilter = '全部';
  sel.innerHTML = ['全部', ...names].map(n =>
    `<option value="${esc(n)}"${n === historyFilter ? ' selected' : ''}>${esc(n === '全部' ? '全部分类' : n)}</option>`).join('');
}
document.getElementById('history-filter').addEventListener('change', e => {
  historyFilter = e.target.value;
  renderSessions();
});

function renderSessions() {
  fillHistoryFilter();
  const list = document.getElementById('sessions-list');
  const sessions = data.sessions.filter(s => historyFilter === '全部' || s.programName === historyFilter);
  if (!sessions.length) {
    list.innerHTML = '<div class="empty">还没有训练记录，创建一次训练开始记录吧。</div>';
    return;
  }
  list.innerHTML = sessions.map(s => {
    const g = GOAL_GUIDE[s.goal];
    return `
    <div class="session" data-session="${s.id}">
      <div class="session-head">
        <div>
          <div class="title">${esc(s.programName)}${s.goal ? `<span class="goal-tag">${esc(s.goal)}</span>` : ''}</div>
          <div class="meta">${esc(s.date)} · ${s.exercises.length} 个动作 · 容量 ${Math.round(sessionVolume(s)).toLocaleString()} kg</div>
        </div>
        <button class="btn small danger" data-del-session="${s.id}">删除</button>
      </div>
      <div class="session-body">
        ${g ? `<div class="session-guide">建议处方　${g.reps}　·　${g.intensity}　·　${g.sets}　·　${g.rest}</div>` : ''}
        ${s.exercises.map(ex => renderExercise(s.id, ex)).join('')}
        <div class="inline-form">
          <input type="text" placeholder="添加动作名称，例如：杠铃卧推" data-add-ex-input="${s.id}">
          <button class="btn small" data-add-ex="${s.id}">+ 动作</button>
        </div>
      </div>
    </div>`;
  }).join('');

  bindSessionEvents();
}

function renderExercise(sessionId, ex) {
  const rows = ex.sets.map((set, i) => {
    const e = est1RM(set.weight, set.reps);
    return `
    <tr>
      <td>${i + 1}</td>
      <td><input type="number" min="0" step="0.5" value="${set.weight ?? ''}" placeholder="kg"
            data-set-weight="${sessionId}|${ex.id}|${i}"></td>
      <td><input type="number" min="0" value="${set.reps ?? ''}" placeholder="Reps"
            data-set-reps="${sessionId}|${ex.id}|${i}"></td>
      <td><input type="number" min="6" max="10" step="0.5" value="${set.rpe ?? ''}" placeholder="RPE"
            data-set-rpe="${sessionId}|${ex.id}|${i}"></td>
      <td class="e1rm-cell">${e ? round1(e) : '—'}</td>
      <td><button class="btn small danger" data-del-set="${sessionId}|${ex.id}|${i}">×</button></td>
    </tr>`;
  }).join('');

  const best = bestSetByE1RM(ex.sets);
  const e1rmLine = best
    ? `<div class="e1rm-badge">本次最佳估算 1RM <b>${round1(best.e1rm)} kg</b>（来自 ${best.w}kg × ${best.r} Reps）</div>`
    : '';

  return `
    <div class="exercise">
      <div class="exercise-head">
        <span class="name">${esc(ex.name)}</span>
        <button class="btn small danger" data-del-ex="${sessionId}|${ex.id}">删除动作</button>
      </div>
      ${overloadHint(sessionId, ex.name)}
      ${ex.sets.length ? `
      <table class="sets-table">
        <thead><tr><th>组</th><th>重量(kg)</th><th>Reps</th><th>RPE</th><th>≈1RM</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>${e1rmLine}` : '<div class="hint" style="margin:0">还没有记录组数</div>'}
      <div class="set-add-row">
        <button class="btn small primary" data-add-set="${sessionId}|${ex.id}">+ 添加一组</button>
      </div>
    </div>`;
}

function bindSessionEvents() {
  const list = document.getElementById('sessions-list');

  list.querySelectorAll('[data-del-session]').forEach(b =>
    b.addEventListener('click', () => {
      if (confirm('确定删除这次训练记录？')) {
        data.sessions = data.sessions.filter(s => s.id !== b.dataset.delSession);
        save(); renderSessions();
      }
    }));

  list.querySelectorAll('[data-add-ex]').forEach(b =>
    b.addEventListener('click', () => {
      const input = list.querySelector(`[data-add-ex-input="${b.dataset.addEx}"]`);
      const name = input.value.trim();
      if (!name) return;
      const s = data.sessions.find(x => x.id === b.dataset.addEx);
      s.exercises.push({ id: uid(), name, sets: [] });
      save(); renderSessions();
    }));

  list.querySelectorAll('[data-del-ex]').forEach(b =>
    b.addEventListener('click', () => {
      const [sid, exid] = b.dataset.delEx.split('|');
      const s = data.sessions.find(x => x.id === sid);
      s.exercises = s.exercises.filter(e => e.id !== exid);
      save(); renderSessions();
    }));

  list.querySelectorAll('[data-add-set]').forEach(b =>
    b.addEventListener('click', () => {
      const [sid, exid] = b.dataset.addSet.split('|');
      const ex = findEx(sid, exid);
      // 新组默认沿用上一组的重量/次数，便于快速记录
      const prev = ex.sets[ex.sets.length - 1];
      ex.sets.push(prev ? { weight: prev.weight, reps: prev.reps, rpe: '' } : { weight: '', reps: '', rpe: '' });
      save(); renderSessions();
    }));

  list.querySelectorAll('[data-del-set]').forEach(b =>
    b.addEventListener('click', () => {
      const [sid, exid, i] = b.dataset.delSet.split('|');
      const ex = findEx(sid, exid);
      ex.sets.splice(Number(i), 1);
      save(); renderSessions();
    }));

  list.querySelectorAll('[data-set-weight]').forEach(inp =>
    inp.addEventListener('change', () => {
      const [sid, exid, i] = inp.dataset.setWeight.split('|');
      findEx(sid, exid).sets[Number(i)].weight = inp.value;
      save(); renderSessions();
    }));

  list.querySelectorAll('[data-set-reps]').forEach(inp =>
    inp.addEventListener('change', () => {
      const [sid, exid, i] = inp.dataset.setReps.split('|');
      findEx(sid, exid).sets[Number(i)].reps = inp.value;
      save(); renderSessions();
    }));

  list.querySelectorAll('[data-set-rpe]').forEach(inp =>
    inp.addEventListener('change', () => {
      const [sid, exid, i] = inp.dataset.setRpe.split('|');
      findEx(sid, exid).sets[Number(i)].rpe = inp.value;
      save();
    }));
}

function findEx(sid, exid) {
  const s = data.sessions.find(x => x.id === sid);
  return s.exercises.find(e => e.id === exid);
}

/* ---------- 渐进超负荷提示 ---------- */
// 找到该动作在“当前训练之前”最近一次有记录的表现
function findPrevExercisePerf(sessionId, exName) {
  const current = data.sessions.find(s => s.id === sessionId);
  if (!current) return null;
  const candidates = data.sessions
    .filter(s => s.id !== sessionId && s.date <= current.date)
    .filter(s => s.exercises.some(e => e.name === exName && e.sets.some(set => Number(set.weight) > 0 && Number(set.reps) > 0)))
    .sort((a, b) => b.date.localeCompare(a.date));
  if (!candidates.length) return null;
  const prev = candidates[0];
  const ex = prev.exercises.find(e => e.name === exName);
  return { date: prev.date, best: bestSetByE1RM(ex.sets) };
}

function overloadHint(sessionId, exName) {
  const prev = findPrevExercisePerf(sessionId, exName);
  if (!prev || !prev.best) return '';
  const { w, r, e1rm } = prev.best;
  // 该次训练的目标 Reps 区间上限（用于双递进判断）
  const session = data.sessions.find(s => s.id === sessionId);
  const topRep = { 力量: 5, 增肌: 12, 耐力: 20, 功能性: 15 }[session && session.goal] || 12;
  const inc = isIsolation(exName) ? 1.25 : 2.5;     // 孤立 +1.25kg，复合 +2.5kg
  const suggestW = roundHalf(w + inc);

  let advice;
  if (r >= topRep) {
    // 已达区间上限 → 加重（双递进）
    advice = `已达目标 Reps 上限，建议加重至 <b>${suggestW}kg</b>（双递进：加重后回到区间下限）`;
  } else {
    // 未达上限 → 同重量加次数
    advice = `建议保持 ${w}kg，争取做到 <b>${r + 1}–${topRep} Reps</b>（先加次数，达上限再加重）`;
  }
  return `<div class="overload-hint">上次 ${esc(prev.date)}：最佳 ${w}kg × ${r} Reps（≈1RM ${round1(e1rm)}kg）<br>${advice}</div>`;
}

/* ---------- 复制上次同项目训练 ---------- */
document.getElementById('copy-last-session').addEventListener('click', () => {
  const programId = document.getElementById('session-program').value;
  const date = document.getElementById('session-date').value || todayStr();
  if (!programId) { alert('请先在“训练项目”中创建项目'); return; }
  const last = data.sessions.find(s => s.programId === programId);
  if (!last) { alert('该项目还没有历史训练可复制'); return; }
  data.sessions.unshift({
    id: uid(),
    programId: last.programId,
    programName: last.programName,
    goal: last.goal || '',
    date,
    exercises: last.exercises.map(ex => ({
      id: uid(),
      name: ex.name,
      sets: ex.sets.map(set => ({ weight: set.weight, reps: set.reps, rpe: set.rpe || '' })),
    })),
  });
  save();
  renderSessions();
  alert('已复制上次「' + last.programName + '」训练，可在此基础上调整。');
});

/* ============================================================
   训练要点 (Tips)
   ============================================================ */
let tipFilter = '全部';

document.getElementById('add-tip').addEventListener('click', () => {
  const title = document.getElementById('tip-title').value.trim();
  const category = document.getElementById('tip-category').value;
  const content = document.getElementById('tip-content').value.trim();
  if (!title || !content) { alert('请填写标题和内容'); return; }
  data.tips.unshift({ id: uid(), title, category, content });
  save();
  document.getElementById('tip-title').value = '';
  document.getElementById('tip-content').value = '';
  renderTips();
});

document.querySelectorAll('.tip-filters .chip').forEach(c =>
  c.addEventListener('click', () => {
    document.querySelectorAll('.tip-filters .chip').forEach(x => x.classList.remove('active'));
    c.classList.add('active');
    tipFilter = c.dataset.filter;
    renderTips();
  }));

function matchFilter(cat) { return tipFilter === '全部' || cat === tipFilter; }

function renderTips() {
  // 内置专业知识库（只读）
  const kb = document.getElementById('knowledge-list');
  const kItems = KNOWLEDGE.filter(t => matchFilter(t.category));
  kb.innerHTML = kItems.length ? kItems.map(t => `
    <div class="tip-item knowledge">
      <span class="badge ${t.category}">${esc(t.category)}</span>
      <div class="title">${esc(t.title)}</div>
      <div class="content">${esc(t.content)}</div>
      <div class="source">来源：${esc(t.source)}</div>
    </div>`).join('') : '<div class="empty">该分类下暂无内容</div>';

  // 用户自定义要点
  const list = document.getElementById('tips-list');
  const items = data.tips.filter(t => matchFilter(t.category));
  list.innerHTML = items.length ? items.map(t => `
    <div class="tip-item">
      <div class="head">
        <div>
          <span class="badge ${t.category}">${esc(t.category)}</span>
          <div class="title">${esc(t.title)}</div>
        </div>
        <button class="btn small danger" data-del-tip="${t.id}">删除</button>
      </div>
      <div class="content">${esc(t.content)}</div>
    </div>`).join('') : '<div class="empty">还没有自定义要点，可在上方添加。</div>';

  list.querySelectorAll('[data-del-tip]').forEach(b =>
    b.addEventListener('click', () => {
      data.tips = data.tips.filter(t => t.id !== b.dataset.delTip);
      save(); renderTips();
    }));
}

/* ============================================================
   动态肌肉解剖（要点页内）
   参考：《格氏解剖学(第41版)》、《奈特人体解剖学图谱》、
        Delavier《力量训练解剖学》、Neumann《肌骨系统运动学》、《运动解剖学》教材
   ============================================================ */
const ANATOMY_SRC = '参考书籍：《格氏解剖学(第41版)》· 《奈特人体解剖学图谱》· Delavier《力量训练解剖学》· Neumann《肌骨系统运动学》· 《运动解剖学》(体育院校教材)';

// 灰色人体底图（前/后通用）
const BODY_BG = `
  <circle cx="100" cy="30" r="17" class="body-bg"/>
  <rect x="92" y="44" width="16" height="12" class="body-bg"/>
  <path d="M70 58 Q100 50 130 58 L126 150 Q100 158 74 150 Z" class="body-bg"/>
  <rect x="48" y="62" width="16" height="58" rx="8" class="body-bg"/>
  <rect x="136" y="62" width="16" height="58" rx="8" class="body-bg"/>
  <rect x="45" y="116" width="14" height="56" rx="7" class="body-bg"/>
  <rect x="141" y="116" width="14" height="56" rx="7" class="body-bg"/>
  <rect x="72" y="150" width="56" height="26" rx="10" class="body-bg"/>
  <rect x="74" y="172" width="22" height="72" rx="11" class="body-bg"/>
  <rect x="104" y="172" width="22" height="72" rx="11" class="body-bg"/>
  <rect x="76" y="246" width="18" height="70" rx="9" class="body-bg"/>
  <rect x="106" y="246" width="18" height="70" rx="9" class="body-bg"/>`;

// 每块肌肉：解剖数据 + 身体图形(左右) + 关节动作动画参数 act{from,to,label}
const ANATOMY = [
  // —— 前侧 ——
  { key: 'delt', name: '三角肌', en: 'Deltoid', view: 'front',
    shapes: '<ellipse class="m-region" data-m="delt" cx="63" cy="70" rx="13" ry="12"/><ellipse class="m-region" data-m="delt" cx="137" cy="70" rx="13" ry="12"/>',
    origin: '锁骨外侧1/3、肩峰、肩胛冈', insertion: '肱骨三角肌粗隆',
    action: '前束—肩前屈/内旋；中束—肩外展；后束—肩后伸/外旋', exercises: '推举、侧平举、前平举、面拉',
    synergist: '冈上肌、胸大肌(前屈)、斜方肌(上回旋)', antagonist: '背阔肌、对侧束',
    cue: '侧平举肘领先、小指略高；勿耸肩借力', act: { from: 5, to: 95, label: '肩外展（侧向抬臂）' } },
  { key: 'pec', name: '胸大肌', en: 'Pectoralis major', view: 'front',
    shapes: '<ellipse class="m-region" data-m="pec" cx="86" cy="88" rx="15" ry="11"/><ellipse class="m-region" data-m="pec" cx="114" cy="88" rx="15" ry="11"/>',
    origin: '锁骨内侧半、胸骨、上6肋软骨', insertion: '肱骨大结节嵴',
    action: '肩水平内收、前屈、内旋（把上臂拉向中线）', exercises: '卧推、上斜卧推、双杠臂屈伸、绳索夹胸',
    synergist: '三角肌前束、肱三头肌、前锯肌', antagonist: '背阔肌、三角肌后束、斜方肌中下部',
    cue: '底部充分伸展，想象“用大臂把两手挤向中线”', act: { from: -45, to: 45, label: '肩水平内收（合臂发力）' } },
  { key: 'biceps', name: '肱二头肌', en: 'Biceps brachii', view: 'front',
    shapes: '<ellipse class="m-region" data-m="biceps" cx="56" cy="112" rx="8" ry="20"/><ellipse class="m-region" data-m="biceps" cx="144" cy="112" rx="8" ry="20"/>',
    origin: '长头—盂上结节；短头—喙突', insertion: '桡骨粗隆、肱二头肌腱膜',
    action: '屈肘、前臂旋后；协助肩前屈', exercises: '杠铃/哑铃弯举、锤式弯举、牧师凳弯举',
    synergist: '肱肌、肱桡肌', antagonist: '肱三头肌',
    cue: '固定肘部、旋后顶峰收缩、离心控制', act: { from: 10, to: 140, label: '肘关节屈曲（弯举）' } },
  { key: 'rectus', name: '腹直肌', en: 'Rectus abdominis', view: 'front',
    shapes: '<rect class="m-region" data-m="rectus" x="91" y="110" width="18" height="46" rx="5"/>',
    origin: '耻骨嵴、耻骨联合', insertion: '第5–7肋软骨、剑突',
    action: '脊柱屈曲、增加腹内压、稳定骨盆', exercises: '卷腹、悬垂举腿、健腹轮',
    synergist: '腹内/外斜肌、腹横肌', antagonist: '竖脊肌',
    cue: '想象“肋骨靠近骨盆”、呼气收缩，而非屈髋', act: { from: 0, to: 42, label: '脊柱屈曲（卷腹）' } },
  { key: 'oblique', name: '腹外斜肌', en: 'External oblique', view: 'front',
    shapes: '<ellipse class="m-region" data-m="oblique" cx="80" cy="128" rx="6" ry="16"/><ellipse class="m-region" data-m="oblique" cx="120" cy="128" rx="6" ry="16"/>',
    origin: '第5–12肋外面', insertion: '髂嵴、腹白线、腹股沟韧带',
    action: '躯干旋转(对侧)、侧屈、屈曲、增加腹压', exercises: '俄罗斯转体、负重侧屈、侧桥',
    synergist: '腹内斜肌、腹直肌', antagonist: '对侧腹斜肌、竖脊肌',
    cue: '旋转由躯干带动而非手臂，控制范围', act: { from: -30, to: 35, label: '躯干旋转 / 侧屈' } },
  { key: 'quads', name: '股四头肌', en: 'Quadriceps femoris', view: 'front',
    shapes: '<ellipse class="m-region" data-m="quads" cx="84" cy="210" rx="13" ry="34"/><ellipse class="m-region" data-m="quads" cx="116" cy="210" rx="13" ry="34"/>',
    origin: '股直肌—髂前下棘；股内/外/中间肌—股骨', insertion: '经髌韧带止于胫骨粗隆',
    action: '伸膝；股直肌还参与屈髋', exercises: '深蹲、腿举、箭步蹲、腿屈伸',
    synergist: '臀大肌(蹲)、小腿三头肌', antagonist: '腘绳肌',
    cue: '下蹲膝对准脚尖、全程控制；腿屈伸顶峰伸直', act: { from: 120, to: 5, label: '膝关节伸展（蹬伸）' } },
  // —— 后侧 ——
  { key: 'traps', name: '斜方肌', en: 'Trapezius', view: 'back',
    shapes: '<path class="m-region" data-m="traps" d="M100 52 L124 66 L100 100 L76 66 Z"/>',
    origin: '枕外隆凸、项韧带、C7–T12 棘突', insertion: '锁骨外1/3、肩峰、肩胛冈',
    action: '上部—上提/上回旋；中部—后缩；下部—下降肩胛', exercises: '耸肩、面拉、划船、Y-T-W',
    synergist: '菱形肌、肩胛提肌、前锯肌', antagonist: '胸小肌、背阔肌',
    cue: '划船先“沉肩+夹背”启动；面拉肘高', act: { from: 20, to: -12, label: '肩胛骨上提 / 后缩' } },
  { key: 'reardelt', name: '三角肌后束', en: 'Posterior deltoid', view: 'back',
    shapes: '<ellipse class="m-region" data-m="reardelt" cx="63" cy="70" rx="13" ry="12"/><ellipse class="m-region" data-m="reardelt" cx="137" cy="70" rx="13" ry="12"/>',
    origin: '肩胛冈', insertion: '肱骨三角肌粗隆',
    action: '肩水平外展、后伸、外旋', exercises: '反向飞鸟、面拉、俯身侧平举',
    synergist: '冈下肌、小圆肌、斜方肌中部', antagonist: '三角肌前束、胸大肌',
    cue: '小重量、肘略屈，想象“把肘往后拉”', act: { from: -30, to: 60, label: '肩水平外展（后拉）' } },
  { key: 'triceps', name: '肱三头肌', en: 'Triceps brachii', view: 'back',
    shapes: '<ellipse class="m-region" data-m="triceps" cx="56" cy="112" rx="8" ry="20"/><ellipse class="m-region" data-m="triceps" cx="144" cy="112" rx="8" ry="20"/>',
    origin: '长头—盂下结节；外/内侧头—肱骨后面', insertion: '尺骨鹰嘴',
    action: '伸肘；长头协助肩后伸/内收', exercises: '卧推、双杠臂屈伸、绳索下压、过顶臂屈伸',
    synergist: '肘肌', antagonist: '肱二头肌、肱肌',
    cue: '固定肘部、顶峰充分伸直；过顶动作练长头', act: { from: 140, to: 10, label: '肘关节伸展（下压/推）' } },
  { key: 'lats', name: '背阔肌', en: 'Latissimus dorsi', view: 'back',
    shapes: '<path class="m-region" data-m="lats" d="M84 98 L98 102 L94 150 L78 126 Z"/><path class="m-region" data-m="lats" d="M116 98 L102 102 L106 150 L122 126 Z"/>',
    origin: 'T7–L5棘突、骶骨、髂嵴、下肋(经胸腰筋膜)', insertion: '肱骨结节间沟',
    action: '肩内收、后伸、内旋（引体时拉躯干向上）', exercises: '引体向上、高位下拉、划船、直臂下压',
    synergist: '大圆肌、肱二头肌、三角肌后束', antagonist: '三角肌、斜方肌上部',
    cue: '先沉肩、用“肘往口袋拉”带动；减少二头借力', act: { from: -60, to: 20, label: '肩内收/后伸（下拉/划船）' } },
  { key: 'erector', name: '竖脊肌', en: 'Erector spinae', view: 'back',
    shapes: '<rect class="m-region" data-m="erector" x="95" y="104" width="4" height="54" rx="2"/><rect class="m-region" data-m="erector" x="101" y="104" width="4" height="54" rx="2"/>',
    origin: '骶骨、髂嵴、腰椎棘突等', insertion: '沿途肋骨、椎骨横突/棘突、至枕骨',
    action: '脊柱伸展、侧屈；维持直立与脊柱稳定', exercises: '硬拉、罗马尼亚硬拉、山羊挺身、早安',
    synergist: '臀大肌、腘绳肌、腰方肌', antagonist: '腹直肌',
    cue: '保持脊柱中立、髋铰链发力；勿过度后伸', act: { from: 40, to: 0, label: '脊柱伸展（挺直）' } },
  { key: 'glutes', name: '臀大肌', en: 'Gluteus maximus', view: 'back',
    shapes: '<ellipse class="m-region" data-m="glutes" cx="88" cy="162" rx="14" ry="13"/><ellipse class="m-region" data-m="glutes" cx="112" cy="162" rx="14" ry="13"/>',
    origin: '髂骨外面、骶/尾骨后面、骶结节韧带', insertion: '髂胫束、股骨臀肌粗隆',
    action: '髋关节伸展、外旋；上部外展', exercises: '臀推、深蹲、硬拉、箭步蹲',
    synergist: '腘绳肌、竖脊肌', antagonist: '髂腰肌',
    cue: '顶峰“夹臀伸髋”，避免靠腰代偿', act: { from: 50, to: -12, label: '髋关节伸展（前推/起身）' } },
  { key: 'hams', name: '腘绳肌', en: 'Hamstrings', view: 'back',
    shapes: '<ellipse class="m-region" data-m="hams" cx="84" cy="210" rx="12" ry="32"/><ellipse class="m-region" data-m="hams" cx="116" cy="210" rx="12" ry="32"/>',
    origin: '坐骨结节、股骨粗线(股二头肌短头)', insertion: '胫骨/腓骨上端',
    action: '屈膝、伸髋', exercises: '罗马尼亚硬拉、腿弯举、早安、臀腿提拉',
    synergist: '臀大肌、腓肠肌', antagonist: '股四头肌、髂腰肌',
    cue: 'RDL 感受坐骨向后、微屈膝，范围内控制', act: { from: 10, to: 120, label: '屈膝 / 伸髋' } },
  { key: 'calves', name: '腓肠肌', en: 'Gastrocnemius', view: 'back',
    shapes: '<ellipse class="m-region" data-m="calves" cx="85" cy="278" rx="10" ry="22"/><ellipse class="m-region" data-m="calves" cx="115" cy="278" rx="10" ry="22"/>',
    origin: '股骨内/外侧髁后面', insertion: '经跟腱止于跟骨',
    action: '踝关节跖屈；协助屈膝', exercises: '站姿提踵、驴式提踵、跳跃',
    synergist: '比目鱼肌、胫骨后肌', antagonist: '胫骨前肌',
    cue: '全程大幅度、顶峰停顿、缓慢下放拉伸', act: { from: 20, to: -25, label: '踝关节跖屈（提踵）' } },
];

let anatomyView = 'front';
let anatomySel = null;

// 关节动作动画（SMIL，Safari 兼容）：固定近端骨 + 绕关节摆动的远端骨 + 脉动的“工作肌肉”
// 3D（CSS 3D 变换）类真人动作演示：每块肌肉驱动相应关节、绕“解剖学正确的轴”运动
//   轴↔平面：rotateX=矢状面(屈伸) · rotateZ=冠状面(外展/内收) · rotateY=水平面(旋转)
//   sel 目标关节，axis 旋转轴(X/Y/Z) 或 TY(竖直平移)，from/to 角度(度)；hot=高亮所在骨；
//   plane=动作所在平面说明；primary=推荐动作；accessory=延伸动作
const ANATOMY_ANIM = {
  delt:     { plane: '冠状面 · 肩外展', primary: '哑铃侧平举', accessory: '站姿杠铃推举',
              hot: ['armL', 'armR'], parts: [{ sel: 'armL', axis: 'Z', from: 0, to: -72 }, { sel: 'armR', axis: 'Z', from: 0, to: 72 }] },
  pec:      { plane: '水平面 · 肩水平内收', primary: '杠铃卧推', accessory: '绳索夹胸',
              hot: ['torso'], parts: [{ sel: 'armL', axis: 'Y', from: 0, to: -55 }, { sel: 'armR', axis: 'Y', from: 0, to: 55 }] },
  biceps:   { plane: '矢状面 · 屈肘', primary: '杠铃弯举', accessory: '牧师凳弯举',
              hot: ['armL', 'armR'], parts: [{ sel: 'foreL', axis: 'X', from: 0, to: -130 }, { sel: 'foreR', axis: 'X', from: 0, to: -130 }] },
  triceps:  { plane: '矢状面 · 伸肘', primary: '窄距卧推', accessory: '绳索下压',
              hot: ['armL', 'armR'], parts: [{ sel: 'foreL', axis: 'X', from: -120, to: -5 }, { sel: 'foreR', axis: 'X', from: -120, to: -5 }] },
  rectus:   { plane: '矢状面 · 脊柱屈曲', primary: '悬垂举腿', accessory: '卷腹',
              hot: ['torso'], parts: [{ sel: 'torso', axis: 'X', from: 0, to: 38 }] },
  oblique:  { plane: '水平面 · 躯干旋转', primary: '俄罗斯转体', accessory: '负重体侧屈',
              hot: ['torso'], parts: [{ sel: 'torso', axis: 'Y', from: -28, to: 28 }] },
  quads:    { plane: '矢状面 · 伸膝', primary: '杠铃深蹲', accessory: '坐姿腿屈伸',
              hot: ['thighL', 'thighR'], parts: [{ sel: 'shankL', axis: 'X', from: 70, to: 0 }, { sel: 'shankR', axis: 'X', from: 70, to: 0 }] },
  traps:    { plane: '冠状面 · 肩胛上提', primary: '杠铃耸肩', accessory: '面拉',
              hot: ['torso'], parts: [{ sel: 'shoulders', axis: 'TY', from: 0, to: -9 }] },
  reardelt: { plane: '水平面 · 肩水平外展', primary: '反向飞鸟', accessory: '面拉',
              hot: ['armL', 'armR'], parts: [{ sel: 'armL', axis: 'Y', from: 0, to: 45 }, { sel: 'armR', axis: 'Y', from: 0, to: -45 }] },
  lats:     { plane: '矢状面 · 肩内收/后伸', primary: '引体向上', accessory: '高位下拉',
              hot: ['torso'], parts: [{ sel: 'armL', axis: 'X', from: -150, to: -12 }, { sel: 'armR', axis: 'X', from: -150, to: -12 }] },
  erector:  { plane: '矢状面 · 脊柱伸展', primary: '硬拉', accessory: '山羊挺身',
              hot: ['torso'], parts: [{ sel: 'torso', axis: 'X', from: 32, to: -5 }] },
  glutes:   { plane: '矢状面 · 伸髋', primary: '臀推', accessory: '罗马尼亚硬拉',
              hot: ['torso'], parts: [{ sel: 'torso', axis: 'X', from: 42, to: 2 }] },
  hams:     { plane: '矢状面 · 屈膝', primary: '罗马尼亚硬拉', accessory: '俯卧腿弯举',
              hot: ['thighL', 'thighR'], parts: [{ sel: 'shankL', axis: 'X', from: 0, to: 92 }, { sel: 'shankR', axis: 'X', from: 0, to: 92 }] },
  calves:   { plane: '矢状面 · 踝跖屈', primary: '站姿提踵', accessory: '坐姿提踵',
              hot: ['shankL', 'shankR'], parts: [{ sel: 'man', axis: 'TY', from: 0, to: -9 }] },
};

// 把 sel 名映射到 3D 小人里的元素 class
const FIG_SEL = {
  torso: 'j-spine', armL: 'j-armL', armR: 'j-armR', foreL: 'j-foreL', foreR: 'j-foreR',
  thighL: 'j-thighL', thighR: 'j-thighR', shankL: 'j-shankL', shankR: 'j-shankR',
  shoulders: 'lm-shoulders', man: 'lm-man',
};

let anatomyPlane = 'fro';   // fro=定格(随所选肌肉转到正/背面) | orbit=旋转
let anatomyMode = localStorage.getItem('dxl-anatmode') || 'svg';   // svg=示意图 | model=3D模型
let anat3dUrl = localStorage.getItem('dxl-anat3d') || '';

// 把用户粘贴的链接/iframe 代码规整为可嵌入的 3D 模型 URL
function to3DEmbed(raw) {
  raw = (raw || '').trim();
  const inIframe = raw.match(/src="([^"]+)"/i);
  if (inIframe) raw = inIframe[1];
  let m = raw.match(/sketchfab\.com\/3d-models\/[^/?#]*-([0-9a-f]{32})/i)
       || raw.match(/sketchfab\.com\/models\/([0-9a-f]{32})/i);
  if (m) return `https://sketchfab.com/models/${m[1]}/embed?autospin=0.3&ui_infos=0&ui_watermark=0`;
  if (/^https?:\/\//i.test(raw)) return raw;   // BioDigital 等已是嵌入地址
  return '';
}

// 各身体段：正面 fr / 背面 bk 两套分块肌群（半透明 SVG，含肌纤维走向线与名称 title）
// class mm-<key> 用于按所选肌肉高亮
const SEG_DATA = {
  torso: {
    vb: '0 0 38 84',
    skin: '<path class="skin" d="M3 9 Q19 1 35 9 L33 60 Q30 78 19 82 Q8 78 5 60 Z"/>',
    fr: `
      <g class="msc mm-pec"><title>胸大肌</title><path d="M6 16 Q18 13 18.5 17 L18.5 31 Q10 33 5 27 Z"/>
        <line class="fiber" x1="6" y1="19" x2="18" y2="20"/><line class="fiber" x1="6" y1="23" x2="18" y2="25"/><line class="fiber" x1="7" y1="27" x2="18" y2="29"/></g>
      <g class="msc mm-pec"><title>胸大肌</title><path d="M32 16 Q20 13 19.5 17 L19.5 31 Q28 33 33 27 Z"/>
        <line class="fiber" x1="32" y1="19" x2="20" y2="20"/><line class="fiber" x1="32" y1="23" x2="20" y2="25"/><line class="fiber" x1="31" y1="27" x2="20" y2="29"/></g>
      <g class="msc mm-oblique"><title>腹外斜肌</title><path d="M8 35 L13 37 L12 60 L9 57 Z"/><line class="fiber" x1="9" y1="38" x2="12" y2="52"/></g>
      <g class="msc mm-oblique"><title>腹外斜肌</title><path d="M30 35 L25 37 L26 60 L29 57 Z"/><line class="fiber" x1="29" y1="38" x2="26" y2="52"/></g>
      <g class="msc mm-rectus"><title>腹直肌</title><rect x="15" y="33" width="8" height="8.5" rx="2"/><rect x="15" y="43" width="8" height="8.5" rx="2"/><rect x="15" y="53" width="8" height="8.5" rx="2"/><line class="fiber" x1="19" y1="33" x2="19" y2="62"/></g>`,
    bk: `
      <g class="msc mm-traps"><title>斜方肌</title><path d="M9 6 L19 2 L19 14 L6 15 Z"/><path d="M29 6 L19 2 L19 14 L32 15 Z"/>
        <line class="fiber" x1="19" y1="3" x2="8" y2="14"/><line class="fiber" x1="19" y1="3" x2="30" y2="14"/></g>
      <g class="msc mm-lats"><title>背阔肌</title><path d="M4 26 L10 30 L9 56 L4 46 Z"/><path d="M34 26 L28 30 L29 56 L34 46 Z"/>
        <line class="fiber" x1="6" y1="30" x2="8" y2="54"/><line class="fiber" x1="32" y1="30" x2="30" y2="54"/></g>
      <g class="msc mm-erector"><title>竖脊肌</title><path d="M15 16 L23 16 L22 62 L16 62 Z"/><line class="fiber" x1="17.5" y1="18" x2="17.5" y2="60"/><line class="fiber" x1="20.5" y1="18" x2="20.5" y2="60"/></g>
      <g class="msc mm-glutes"><title>臀大肌</title><path d="M7 64 Q13 60 18 67 L17 80 Q10 82 6 76 Z"/><path d="M31 64 Q25 60 20 67 L21 80 Q28 82 32 76 Z"/>
        <line class="fiber" x1="8" y1="66" x2="15" y2="78"/><line class="fiber" x1="30" y1="66" x2="23" y2="78"/></g>`,
  },
  arm: {
    vb: '0 0 12 33',
    skin: '<path class="skin" d="M2 3 Q6 0 10 3 L9 31 Q6 33 3 31 Z"/>',
    fr: `<g class="msc mm-delt"><title>三角肌</title><ellipse cx="6" cy="5" rx="5" ry="4"/><line class="fiber" x1="3" y1="4" x2="6" y2="9"/><line class="fiber" x1="9" y1="4" x2="6" y2="9"/></g>
      <g class="msc mm-biceps"><title>肱二头肌</title><ellipse cx="5" cy="18" rx="3.3" ry="9"/><line class="fiber" x1="5" y1="10" x2="5" y2="26"/></g>`,
    bk: `<g class="msc mm-reardelt"><title>三角肌后束</title><ellipse cx="6" cy="5" rx="5" ry="4"/><line class="fiber" x1="3" y1="4" x2="6" y2="9"/><line class="fiber" x1="9" y1="4" x2="6" y2="9"/></g>
      <g class="msc mm-triceps"><title>肱三头肌</title><ellipse cx="6" cy="18" rx="3.5" ry="9"/><line class="fiber" x1="6" y1="10" x2="6" y2="26"/><line class="fiber" x1="4.4" y1="12" x2="4.4" y2="24"/></g>`,
  },
  fore: {
    vb: '0 0 9 30',
    skin: '<path class="skin" d="M2 1 L7 1 L6 29 L3 29 Z"/>',
    fr: '<g class="msc mm-forearm"><title>前臂屈肌群</title><ellipse cx="4.5" cy="12" rx="3" ry="9"/><line class="fiber" x1="4.5" y1="4" x2="4.5" y2="20"/></g>',
    bk: '<g class="msc mm-forearm"><title>前臂伸肌群</title><ellipse cx="4.5" cy="12" rx="3" ry="9"/><line class="fiber" x1="4.5" y1="4" x2="4.5" y2="20"/></g>',
  },
  thigh: {
    vb: '0 0 15 46',
    skin: '<path class="skin" d="M2 2 Q7.5 0 13 2 L12 44 Q7.5 46 3 44 Z"/>',
    fr: '<g class="msc mm-quads"><title>股四头肌</title><ellipse cx="7.5" cy="22" rx="5" ry="18"/><line class="fiber" x1="6" y1="6" x2="6" y2="40"/><line class="fiber" x1="9" y1="6" x2="9" y2="40"/><line class="fiber" x1="7.5" y1="5" x2="7.5" y2="41"/></g>',
    bk: '<g class="msc mm-hams"><title>腘绳肌</title><ellipse cx="7.5" cy="24" rx="5" ry="17"/><line class="fiber" x1="6" y1="8" x2="6" y2="40"/><line class="fiber" x1="9" y1="8" x2="9" y2="40"/></g>',
  },
  shank: {
    vb: '0 0 11 44',
    skin: '<path class="skin" d="M2 1 Q5.5 0 9 1 L8 43 Q5.5 44 3 43 Z"/>',
    fr: '<g class="msc mm-tib"><title>胫骨前肌</title><ellipse cx="5.5" cy="16" rx="3" ry="11"/><line class="fiber" x1="5.5" y1="6" x2="5.5" y2="26"/></g>',
    bk: '<g class="msc mm-calves"><title>腓肠肌</title><ellipse cx="5.5" cy="13" rx="4" ry="10"/><line class="fiber" x1="4" y1="4" x2="4" y2="22"/><line class="fiber" x1="7" y1="4" x2="7" y2="22"/></g>',
  },
};
function segWrap(name) {
  const d = SEG_DATA[name];
  return `<div class="segwrap sw-${name}">
    <svg class="face fr" viewBox="${d.vb}" preserveAspectRatio="none">${d.skin}${d.fr}</svg>
    <svg class="face bk" viewBox="${d.vb}" preserveAspectRatio="none">${d.skin}${d.bk}</svg>
  </div>`;
}
const SEG = {
  get torso() { return segWrap('torso'); }, get arm() { return segWrap('arm'); },
  get fore() { return segWrap('fore'); }, get thigh() { return segWrap('thigh'); },
  get shank() { return segWrap('shank'); },
};

function figure3D(m) {
  const an = ANATOMY_ANIM[m.key] || { parts: [], hot: [] };
  // 为每个被驱动的关节生成唯一 @keyframes，并记录其元素 class → 动画
  let kf = '';
  const animOf = {};
  (an.parts || []).forEach((p, i) => {
    const name = `mv_${m.key}_${i}`;
    const frame = v => p.axis === 'TY' ? `transform:translateY(${v}px)` : `transform:rotate${p.axis}(${v}deg)`;
    kf += `@keyframes ${name}{0%,100%{${frame(p.from)}}50%{${frame(p.to)}}}`;
    animOf[FIG_SEL[p.sel]] = `${name} 2.6s ease-in-out infinite`;
  });
  const A = cls => animOf[cls] ? ` style="animation:${animOf[cls]}"` : '';
  const orbit = anatomyPlane === 'orbit';
  const faceDeg = m.view === 'back' ? 180 : 0;   // 背部肌肉自动转到背面观
  const figStyle = orbit ? '' : ` style="transform:rotateX(-6deg) rotateY(${faceDeg}deg)"`;
  const vcls = orbit ? 'v-orbit' : 'v-face';

  return `<style>${kf}</style>
  <div class="scene3d">
    <div class="fig-name">${esc(m.name)} · <span>${esc(m.en)}</span></div>
    <div class="fig3d ${vcls}"${figStyle}>
      <div class="man lm-man"${A('lm-man')}>
        <div class="head"></div>
        <div class="limb spine"><div class="joint j-spine"${A('j-spine')}>
          ${SEG.torso}
          <div class="limb shoulders lm-shoulders"${A('lm-shoulders')}>
            <div class="limb armL"><div class="joint j-armL"${A('j-armL')}>
              ${SEG.arm}
              <div class="limb fore"><div class="joint j-foreL"${A('j-foreL')}>${SEG.fore}</div></div>
            </div></div>
            <div class="limb armR"><div class="joint j-armR"${A('j-armR')}>
              ${SEG.arm}
              <div class="limb fore"><div class="joint j-foreR"${A('j-foreR')}>${SEG.fore}</div></div>
            </div></div>
          </div>
          <div class="limb hips">
            <div class="limb thighL"><div class="joint j-thighL"${A('j-thighL')}>
              ${SEG.thigh}
              <div class="limb shank"><div class="joint j-shankL"${A('j-shankL')}>${SEG.shank}</div></div>
            </div></div>
            <div class="limb thighR"><div class="joint j-thighR"${A('j-thighR')}>
              ${SEG.thigh}
              <div class="limb shank"><div class="joint j-shankR"${A('j-shankR')}>${SEG.shank}</div></div>
            </div></div>
          </div>
        </div></div>
      </div>
    </div>
  </div>
  <div class="plane-tag">${esc(an.primary ? an.primary + '（' + (an.plane || '') + '）' : (m.act ? m.act.label : ''))}</div>`;
}

function renderAnatomy() {
  const box = document.getElementById('anatomy');
  const muscles = ANATOMY.filter(m => m.view === anatomyView);
  if (!anatomySel || !muscles.some(m => m.key === anatomySel)) anatomySel = muscles[0].key;
  const sel = ANATOMY.find(m => m.key === anatomySel);
  const an = ANATOMY_ANIM[sel.key] || {};
  const planes = [['fro', '定格'], ['orbit', '旋转']];

  // 解剖可视化：示意图(自绘) 或 3D 模型(嵌入)
  let visual;
  if (anatomyMode === 'model') {
    visual = anat3dUrl
      ? `<div class="model3d"><iframe src="${esc(anat3dUrl)}" title="3D 解剖模型" frameborder="0"
            allow="autoplay; fullscreen; xr-spatial-tracking" allowfullscreen
            mozallowfullscreen="true" webkitallowfullscreen="true"></iframe></div>
         <div class="model-actions"><button class="btn small" id="anat-changemodel">更换模型</button>
           <span class="hint" style="margin:0">拖动可旋转/缩放查看</span></div>`
      : `<div class="card model-setup">
           <p class="hint">嵌入真实 3D 解剖模型（来自 Sketchfab / BioDigital 等，需联网）。请粘贴模型的分享/嵌入链接：</p>
           <input type="text" id="anat-url-input" placeholder="粘贴 Sketchfab 模型链接或 iframe 代码">
           <button class="btn primary" id="anat-url-save" style="margin-top:8px">加载模型</button>
           <div class="hint" style="margin-top:10px">
             获取方法：在 <a href="https://sketchfab.com/search?q=muscular+anatomy&type=models&licenses=322a749bcfa841b29dff1e8a1bb74b0b" target="_blank" rel="noopener">Sketchfab 免费解剖模型</a>
             选一个 → 点 <b>Share / Embed</b> → 复制链接粘贴到上面。也支持 BioDigital 嵌入地址。
           </div>
         </div>`;
  } else {
    visual = `
      <div class="anat-main">
        <svg class="body-svg" viewBox="0 0 200 330">${BODY_BG}${muscles.map(m => m.shapes).join('')}</svg>
        <div class="anat-side">
          <div class="anat-chips">${muscles.map(m =>
            `<button class="chip ${m.key === anatomySel ? 'active' : ''}" data-anat-m="${m.key}">${esc(m.name)}</button>`).join('')}</div>
          <div class="anat-planes">${planes.map(([v, t]) =>
            `<button class="chip ${anatomyPlane === v ? 'active' : ''}" data-anat-plane="${v}">${t}</button>`).join('')}</div>
          ${figure3D(sel)}
        </div>
      </div>`;
  }

  box.innerHTML = `
    <div class="card">
      <h2>肌肉解剖</h2>
      <div class="anat-toggle">
        <button class="chip ${anatomyMode === 'svg' ? 'active' : ''}" data-anat-mode="svg">解剖示意图</button>
        <button class="chip ${anatomyMode === 'model' ? 'active' : ''}" data-anat-mode="model">3D 模型</button>
      </div>
      ${anatomyMode === 'svg' ? `<div class="anat-toggle">
        <button class="chip ${anatomyView === 'front' ? 'active' : ''}" data-anat-view="front">前侧</button>
        <button class="chip ${anatomyView === 'back' ? 'active' : ''}" data-anat-view="back">后侧</button>
      </div>` : ''}
      ${visual}
      <div class="anat-detail">
        <div class="title">${esc(sel.name)} <span class="anat-en">${esc(sel.en)}</span></div>
        <table class="anat-table">
          <tr><th>起点</th><td>${esc(sel.origin)}</td></tr>
          <tr><th>止点</th><td>${esc(sel.insertion)}</td></tr>
          <tr><th>主要功能</th><td>${esc(sel.action)}</td></tr>
          <tr><th>运动平面</th><td>${esc(an.plane || '—')}</td></tr>
          <tr><th>推荐动作</th><td>${esc(an.primary || '—')}</td></tr>
          <tr><th>延伸动作</th><td>${esc(an.accessory || '—')}</td></tr>
          <tr><th>主要训练</th><td>${esc(sel.exercises)}</td></tr>
          <tr><th>协同肌</th><td>${esc(sel.synergist)}</td></tr>
          <tr><th>拮抗肌</th><td>${esc(sel.antagonist)}</td></tr>
          <tr><th>发力要点</th><td>${esc(sel.cue)}</td></tr>
        </table>
        <div class="source">${esc(ANATOMY_SRC)}</div>
      </div>
    </div>`;

  box.querySelectorAll('[data-anat-mode]').forEach(b =>
    b.addEventListener('click', () => {
      anatomyMode = b.dataset.anatMode; localStorage.setItem('dxl-anatmode', anatomyMode); renderAnatomy();
    }));
  if (anatomyMode === 'svg') {
    box.querySelectorAll(`[data-m="${anatomySel}"]`).forEach(el => el.classList.add('active'));
    box.querySelectorAll(`.mm-${anatomySel}`).forEach(el => el.classList.add('hot'));
    box.querySelectorAll('[data-anat-view]').forEach(b =>
      b.addEventListener('click', () => { anatomyView = b.dataset.anatView; anatomySel = null; renderAnatomy(); }));
    box.querySelectorAll('[data-anat-m]').forEach(b =>
      b.addEventListener('click', () => { anatomySel = b.dataset.anatM; renderAnatomy(); }));
    box.querySelectorAll('.body-svg [data-m]').forEach(el =>
      el.addEventListener('click', () => { anatomySel = el.dataset.m; renderAnatomy(); }));
    box.querySelectorAll('[data-anat-plane]').forEach(b =>
      b.addEventListener('click', () => { anatomyPlane = b.dataset.anatPlane; renderAnatomy(); }));
  } else {
    const saveUrl = () => {
      const url = to3DEmbed(document.getElementById('anat-url-input').value);
      if (!url) { alert('链接无法识别，请粘贴 Sketchfab 模型链接或 iframe 代码'); return; }
      anat3dUrl = url; localStorage.setItem('dxl-anat3d', url); renderAnatomy();
    };
    const saveBtn = document.getElementById('anat-url-save');
    if (saveBtn) saveBtn.addEventListener('click', saveUrl);
    const changeBtn = document.getElementById('anat-changemodel');
    if (changeBtn) changeBtn.addEventListener('click', () => {
      anat3dUrl = ''; localStorage.removeItem('dxl-anat3d'); renderAnatomy();
    });
  }
}

/* ============================================================
   数据统计 (Stats)
   ============================================================ */
function sessionVolume(s) {
  return s.exercises.reduce((sum, ex) =>
    sum + ex.sets.reduce((t, set) =>
      t + (Number(set.weight) || 0) * (Number(set.reps) || 0), 0), 0);
}

// 返回某日期所在 ISO 周的标识，如 "2026-W24"
function weekKey(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const day = (d.getUTCDay() + 6) % 7;            // 周一为 0
  d.setUTCDate(d.getUTCDate() - day + 3);          // 移到周四
  const firstThu = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d - firstThu) / 86400000 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function barChart(rows) {
  if (!rows.length) return '<div class="empty">暂无数据</div>';
  const max = Math.max(...rows.map(r => r.value), 1);
  return `<div class="bar-chart">${rows.map(r => `
    <div class="bar-row">
      <span class="bar-label">${esc(r.label)}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${(r.value / max * 100).toFixed(1)}%"></span></span>
      <span class="bar-val">${r.display ?? r.value}</span>
    </div>`).join('')}</div>`;
}

function renderStats() {
  // 概览
  const totalSessions = data.sessions.length;
  const totalVolume = data.sessions.reduce((t, s) => t + sessionVolume(s), 0);
  const totalSets = data.sessions.reduce((t, s) =>
    t + s.exercises.reduce((c, ex) => c + ex.sets.length, 0), 0);
  const last7 = data.sessions.filter(s => {
    const diff = (Date.now() - new Date(s.date + 'T00:00:00')) / 86400000;
    return diff >= 0 && diff < 7;
  }).length;

  document.getElementById('stat-summary').innerHTML = `
    <div class="stat-box"><div class="num">${totalSessions}</div><div class="lbl">总训练次数</div></div>
    <div class="stat-box"><div class="num">${last7}</div><div class="lbl">近 7 天训练</div></div>
    <div class="stat-box"><div class="num">${totalSets}</div><div class="lbl">总组数</div></div>
    <div class="stat-box"><div class="num">${Math.round(totalVolume).toLocaleString()}</div><div class="lbl">总容量 (kg)</div></div>`;

  // 每周训练容量（最近 8 周）
  const byWeek = {};
  data.sessions.forEach(s => {
    const k = weekKey(s.date);
    byWeek[k] = (byWeek[k] || 0) + sessionVolume(s);
  });
  const weekRows = Object.keys(byWeek).sort().slice(-8).map(k => ({
    label: k.replace(/^\d+-/, ''),
    value: Math.round(byWeek[k]),
    display: Math.round(byWeek[k]).toLocaleString(),
  }));
  document.getElementById('volume-chart').innerHTML = barChart(weekRows);

  // 动作进步追踪
  const exNames = [...new Set(data.sessions.flatMap(s => s.exercises.map(e => e.name)))].sort();
  const sel = document.getElementById('progress-exercise');
  const prevVal = sel.value;
  sel.innerHTML = exNames.length
    ? exNames.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('')
    : '<option value="">暂无动作数据</option>';
  if (exNames.includes(prevVal)) sel.value = prevVal;
  renderProgressChart();
}

function renderProgressChart() {
  const name = document.getElementById('progress-exercise').value;
  const metric = document.getElementById('progress-metric').value;
  const box = document.getElementById('progress-chart');
  if (!name) { box.innerHTML = '<div class="empty">暂无数据</div>'; return; }
  const rows = data.sessions
    .filter(s => s.exercises.some(e => e.name === name))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(s => {
      const ex = s.exercises.find(e => e.name === name);
      let value, display;
      if (metric === 'maxw') {
        value = Math.max(0, ...ex.sets.map(set => Number(set.weight) || 0));
        display = round1(value) + ' kg';
      } else if (metric === 'volume') {
        value = ex.sets.reduce((t, set) => t + (Number(set.weight) || 0) * (Number(set.reps) || 0), 0);
        display = Math.round(value).toLocaleString() + ' kg';
      } else {
        const best = bestSetByE1RM(ex.sets);
        value = best ? round1(best.e1rm) : 0;
        display = value + ' kg';
      }
      return { label: s.date.slice(5), value, display };
    })
    .filter(r => r.value > 0)
    .slice(-10);
  box.innerHTML = barChart(rows);
}

document.getElementById('progress-exercise').addEventListener('change', renderProgressChart);
document.getElementById('progress-metric').addEventListener('change', renderProgressChart);

/* ---------- 1RM 估算与强度表 ---------- */
document.getElementById('calc-run').addEventListener('click', () => {
  const w = Number(document.getElementById('calc-weight').value);
  const r = Number(document.getElementById('calc-reps').value);
  const box = document.getElementById('calc-result');
  if (!(w > 0) || !(r > 0)) { box.innerHTML = '<div class="hint">请输入有效的重量与次数</div>'; return; }
  const e = est1RM(w, r), b = est1RM_brzycki(w, r);
  // 各强度区间 → 对应重量与训练用途
  const zones = [
    ['100%', 1, '极限测试'], ['95%', 2, '力量'], ['90%', 4, '力量'],
    ['85%', 6, '力量 / 增肌'], ['80%', 8, '增肌'], ['75%', 10, '增肌'],
    ['70%', 12, '增肌 / 耐力'], ['65%', 15, '耐力'], ['60%', 18, '耐力'],
  ];
  const rows = zones.map(([pct, reps, use]) =>
    `<tr><td>${pct}</td><td>${round1(e * parseInt(pct) / 100)} kg</td><td>~${reps}</td><td>${use}</td></tr>`).join('');
  box.innerHTML = `
    <div class="e1rm-badge" style="margin:12px 0">估算 1RM：<b>${round1(e)} kg</b>
      <span class="hint" style="display:inline">（Epley）· Brzycki ${round1(b)} kg</span></div>
    <table class="sets-table strength-table">
      <thead><tr><th>强度 %1RM</th><th>对应重量</th><th>可做次数</th><th>训练用途</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="hint" style="margin-top:8px">注：%1RM↔Reps 为群体平均值，个体可能有差异；reps≤10 时估算更可靠。</div>`;
});

/* ============================================================
   数据备份：导出 / 导入
   ============================================================ */
document.getElementById('export-data').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `健身记录备份_${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('import-data').addEventListener('click', () =>
  document.getElementById('import-file').click());

document.getElementById('import-file').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!parsed || !Array.isArray(parsed.programs) || !Array.isArray(parsed.sessions) || !Array.isArray(parsed.tips))
        throw new Error('文件格式不正确');
      if (!confirm('导入将覆盖当前所有数据，确定继续？')) return;
      data = parsed;
      save();
      renderPrograms(); renderSessions(); renderTips(); renderStats();
      alert('导入成功！');
    } catch (err) {
      alert('导入失败：' + err.message);
    } finally {
      e.target.value = '';
    }
  };
  reader.readAsText(file);
});

/* ============================================================
   运动日历 (Calendar)
   ============================================================ */
let calYear, calMonth, calSelected = null;
const MONTH_NAMES = ['一月', '二月', '三月', '四月', '五月', '六月',
  '七月', '八月', '九月', '十月', '十一月', '十二月'];

function renderCalendar() {
  const now = new Date();
  if (calYear === undefined) { calYear = now.getFullYear(); calMonth = now.getMonth(); }

  document.getElementById('cal-title').textContent = `${calYear} 年 ${MONTH_NAMES[calMonth]}`;

  // 统计每天的训练次数
  const counts = {};
  data.sessions.forEach(s => { counts[s.date] = (counts[s.date] || 0) + 1; });

  const firstDay = new Date(calYear, calMonth, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;        // 周一为第一列
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const todayKey = todayStr();

  let cells = '';
  for (let i = 0; i < startOffset; i++) cells += '<div class="cal-cell blank"></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const cls = ['cal-cell'];
    if (counts[key]) cls.push('has-workout');
    if (key === todayKey) cls.push('today');
    if (key === calSelected) cls.push('selected');
    cells += `<div class="${cls.join(' ')}" data-date="${key}">
      <span>${d}</span>${counts[key] ? '<span class="cal-dot"></span>' : ''}
    </div>`;
  }
  document.getElementById('cal-grid').innerHTML = cells;

  // 所有日期均可点击（移动端可正常响应），无训练也能查看
  document.querySelectorAll('#cal-grid .cal-cell:not(.blank)').forEach(c =>
    c.addEventListener('click', () => {
      calSelected = c.dataset.date;
      renderCalendar();
    }));

  renderCalDetail();
}

function renderCalDetail() {
  const box = document.getElementById('cal-day-detail');
  if (!calSelected) { box.innerHTML = ''; return; }
  const sessions = data.sessions.filter(s => s.date === calSelected);
  if (!sessions.length) {
    box.innerHTML = `<div class="card"><div class="empty">${esc(calSelected)} 没有训练记录</div></div>`;
    return;
  }
  box.innerHTML = `<div class="card"><h2>${esc(calSelected)} 的训练</h2>
    ${sessions.map(s => `
      <div class="exercise">
        <div class="exercise-head"><span class="name">${esc(s.programName)}</span></div>
        ${s.exercises.map(ex => {
          const done = ex.sets.filter(set => Number(set.weight) > 0 || Number(set.reps) > 0);
          return `<div style="font-size:.85rem;margin:4px 0;color:var(--muted)">
            ${esc(ex.name)}：${done.length
              ? done.map(set => `${set.weight || 0}kg×${set.reps || 0}`).join('，')
              : '未记录组数'}</div>`;
        }).join('')}
      </div>`).join('')}
  </div>`;
}

document.getElementById('cal-prev').addEventListener('click', () => {
  if (--calMonth < 0) { calMonth = 11; calYear--; }
  renderCalendar();
});
document.getElementById('cal-next').addEventListener('click', () => {
  if (++calMonth > 11) { calMonth = 0; calYear++; }
  renderCalendar();
});

/* ============================================================
   饮食营养（身体信息 + 个性化建议 + 食物热量查询）
   参考：Mifflin-St Jeor (1990)；ISSN 立场声明 (Jäger 2017 蛋白质 / Kerksick 2018)；
   ACSM/AND/DC 联合营养声明；《运动营养学》《中国食物成分表(第6版)》；USDA FoodData Central。
   ============================================================ */
// 每 100g 可食部：kcal 热量、p 蛋白(g)、c 碳水(g)、f 脂肪(g)
const FOOD_DB = [
  { n: '白米饭(熟)', kcal: 116, p: 2.6, c: 25.9, f: 0.3 },
  { n: '大米(生)', kcal: 346, p: 7.4, c: 77.9, f: 0.8 },
  { n: '馒头', kcal: 223, p: 7.0, c: 47.0, f: 1.1 },
  { n: '全麦面包', kcal: 246, p: 9.0, c: 46.0, f: 3.4 },
  { n: '燕麦片', kcal: 367, p: 15.0, c: 61.0, f: 7.0 },
  { n: '红薯', kcal: 86, p: 1.6, c: 20.1, f: 0.1 },
  { n: '土豆', kcal: 77, p: 2.0, c: 17.2, f: 0.1 },
  { n: '玉米(鲜)', kcal: 112, p: 4.0, c: 22.8, f: 1.2 },
  { n: '面条(熟)', kcal: 110, p: 4.0, c: 23.0, f: 0.5 },
  { n: '鸡胸肉(生)', kcal: 118, p: 24.0, c: 0, f: 1.9 },
  { n: '鸡腿肉(去皮)', kcal: 146, p: 19.0, c: 0, f: 7.5 },
  { n: '鸡蛋', kcal: 144, p: 13.3, c: 2.8, f: 8.8 },
  { n: '蛋清', kcal: 52, p: 11.0, c: 0.7, f: 0.1 },
  { n: '牛肉(瘦,生)', kcal: 125, p: 20.2, c: 1.2, f: 4.5 },
  { n: '猪里脊(生)', kcal: 155, p: 20.2, c: 0.7, f: 7.9 },
  { n: '三文鱼(生)', kcal: 179, p: 20.0, c: 0, f: 11.0 },
  { n: '虾仁(生)', kcal: 93, p: 18.6, c: 0.9, f: 0.8 },
  { n: '金枪鱼(水浸罐)', kcal: 116, p: 26.0, c: 0, f: 1.0 },
  { n: '北豆腐', kcal: 116, p: 12.2, c: 2.4, f: 6.7 },
  { n: '全脂牛奶', kcal: 65, p: 3.3, c: 4.9, f: 3.6 },
  { n: '脱脂牛奶', kcal: 35, p: 3.4, c: 5.0, f: 0.2 },
  { n: '酸奶(全脂)', kcal: 72, p: 2.5, c: 9.3, f: 2.7 },
  { n: '希腊酸奶(脱脂)', kcal: 59, p: 10.0, c: 3.6, f: 0.4 },
  { n: '乳清蛋白粉', kcal: 380, p: 80.0, c: 8.0, f: 6.0 },
  { n: '西兰花', kcal: 34, p: 2.8, c: 6.6, f: 0.4 },
  { n: '菠菜', kcal: 24, p: 2.6, c: 3.6, f: 0.3 },
  { n: '黄瓜', kcal: 16, p: 0.8, c: 3.6, f: 0.2 },
  { n: '番茄', kcal: 20, p: 0.9, c: 4.0, f: 0.2 },
  { n: '胡萝卜', kcal: 41, p: 0.9, c: 9.6, f: 0.2 },
  { n: '生菜', kcal: 15, p: 1.4, c: 2.9, f: 0.2 },
  { n: '香蕉', kcal: 93, p: 1.4, c: 22.0, f: 0.2 },
  { n: '苹果', kcal: 54, p: 0.2, c: 14.0, f: 0.2 },
  { n: '橙子', kcal: 48, p: 0.8, c: 11.1, f: 0.2 },
  { n: '蓝莓', kcal: 57, p: 0.7, c: 14.5, f: 0.3 },
  { n: '牛油果', kcal: 160, p: 2.0, c: 8.5, f: 14.7 },
  { n: '杏仁', kcal: 579, p: 21.0, c: 22.0, f: 50.0 },
  { n: '花生', kcal: 567, p: 26.0, c: 16.0, f: 49.0 },
  { n: '核桃', kcal: 654, p: 15.0, c: 14.0, f: 65.0 },
  { n: '花生酱', kcal: 588, p: 25.0, c: 20.0, f: 50.0 },
  { n: '橄榄油', kcal: 899, p: 0, c: 0, f: 100.0 },
  { n: '黑咖啡(无糖)', kcal: 1, p: 0.1, c: 0, f: 0 },
  { n: '黑巧克力(70%)', kcal: 546, p: 7.8, c: 46.0, f: 31.0 },
  { n: '白砂糖', kcal: 400, p: 0, c: 100.0, f: 0 },
];

const ACTIVITY_LABEL = {
  '1.2': '久坐', '1.375': '轻度', '1.55': '中度', '1.725': '高度', '1.9': '极高',
};

function computeNutrition(pf) {
  const w = +pf.weight, h = +pf.height, age = +pf.age, pal = +pf.activity || 1.55;
  if (!(w > 0) || !(h > 0) || !(age > 0)) return null;
  // Mifflin-St Jeor 基础代谢率
  const bmr = pf.gender === 'female'
    ? 10 * w + 6.25 * h - 5 * age - 161
    : 10 * w + 6.25 * h - 5 * age + 5;
  const tdee = bmr * pal;
  let target, proteinPerKg;
  if (pf.goal === 'cut') { target = tdee - 500; proteinPerKg = 2.0; }       // 减脂：缺口约 500 kcal，高蛋白保瘦体重
  else if (pf.goal === 'bulk') { target = tdee + 350; proteinPerKg = 1.8; } // 增肌：盈余约 350 kcal
  else { target = tdee; proteinPerKg = 1.6; }                               // 维持
  const protein = proteinPerKg * w;                       // g
  const fat = Math.max(0.8 * w, target * 0.25 / 9);       // g：≥0.8g/kg 或 25% 热量取大者
  const carb = Math.max(0, (target - protein * 4 - fat * 9) / 4); // g：余量
  const bmi = w / ((h / 100) ** 2);
  return { bmr, tdee, target, protein, fat, carb, bmi };
}

function bmiCategory(bmi) {
  // 中国成人标准 (WGOC)
  if (bmi < 18.5) return '偏瘦';
  if (bmi < 24) return '正常';
  if (bmi < 28) return '超重';
  return '肥胖';
}

const GOAL_TEXT = {
  cut: '减脂期：制造约 500 kcal/天热量缺口（每周约减 0.4–0.5 kg）。保持高蛋白(约 2.0 g/kg)以保留肌肉，多吃高饱腹、低能量密度食物（蔬菜、瘦肉、全谷），力量训练维持刺激。',
  maintain: '维持期：热量与消耗持平。蛋白约 1.6 g/kg，均衡分配碳水与脂肪，关注训练表现与恢复。',
  bulk: '增肌期：制造约 300–500 kcal/天热量盈余（“干净增肌”每周约增 0.25 kg）。蛋白约 1.8 g/kg，充足碳水支持训练，配合渐进超负荷。',
};

function renderDiet() {
  const pf = data.profile || {};
  // 回填表单
  if (pf.gender) document.getElementById('pf-gender').value = pf.gender;
  if (pf.age) document.getElementById('pf-age').value = pf.age;
  if (pf.height) document.getElementById('pf-height').value = pf.height;
  if (pf.weight) document.getElementById('pf-weight').value = pf.weight;
  if (pf.activity) document.getElementById('pf-activity').value = pf.activity;
  if (pf.goal) document.getElementById('pf-goal').value = pf.goal;
  renderDietResult();
  renderFood(document.getElementById('food-search').value);
}

function renderDietResult() {
  const box = document.getElementById('diet-result');
  const n = computeNutrition(data.profile || {});
  if (!n) { box.innerHTML = '<div class="card"><div class="empty">填写并保存身体信息后，这里会显示个性化饮食建议</div></div>'; return; }
  const goal = data.profile.goal || 'maintain';
  box.innerHTML = `
    <div class="card">
      <h2>个性化饮食建议</h2>
      <div class="stat-grid">
        <div class="stat-box"><div class="num">${Math.round(n.target)}</div><div class="lbl">目标热量 (kcal/天)</div></div>
        <div class="stat-box"><div class="num">${Math.round(n.protein)}</div><div class="lbl">蛋白质 (g)</div></div>
        <div class="stat-box"><div class="num">${Math.round(n.carb)}</div><div class="lbl">碳水 (g)</div></div>
        <div class="stat-box"><div class="num">${Math.round(n.fat)}</div><div class="lbl">脂肪 (g)</div></div>
      </div>
      <div class="diet-meta">
        <span>BMR ${Math.round(n.bmr)} kcal</span>
        <span>TDEE ${Math.round(n.tdee)} kcal</span>
        <span>BMI ${round1(n.bmi)}（${bmiCategory(n.bmi)}）</span>
      </div>
      <div class="content" style="margin-top:10px">${esc(GOAL_TEXT[goal])}</div>
      <div class="content" style="margin-top:8px">建议蛋白质均分到每餐（每餐约 ${Math.round(n.protein / 4)}–${Math.round(n.protein / 3)} g），训练后补充碳水+蛋白促进恢复。每日饮水约 30–40 ml/kg 体重。</div>
      <div class="source">公式：Mifflin-St Jeor (BMR) × 活动系数(${ACTIVITY_LABEL[data.profile.activity] || ''})；蛋白/热量区间参考 ISSN 立场声明与《运动营养学》。本建议为一般营养教育，不替代医疗/临床营养诊疗。</div>
    </div>`;
}

document.getElementById('pf-save').addEventListener('click', () => {
  data.profile = {
    gender: document.getElementById('pf-gender').value,
    age: document.getElementById('pf-age').value,
    height: document.getElementById('pf-height').value,
    weight: document.getElementById('pf-weight').value,
    activity: document.getElementById('pf-activity').value,
    goal: document.getElementById('pf-goal').value,
  };
  save();
  renderDietResult();
  if (!computeNutrition(data.profile)) alert('请完整填写年龄、身高、体重');
});

function renderFood(query) {
  const box = document.getElementById('food-result');
  const q = (query || '').trim();
  let list = FOOD_DB;
  if (q) list = FOOD_DB.filter(food => food.n.includes(q));
  list = list.slice(0, 30);
  if (!list.length) { box.innerHTML = '<div class="empty">没有找到该食物</div>'; return; }
  box.innerHTML = `
    <table class="sets-table strength-table" style="margin-top:10px">
      <thead><tr><th>食物 (每100g)</th><th>热量</th><th>蛋白</th><th>碳水</th><th>脂肪</th></tr></thead>
      <tbody>${list.map(food => `<tr>
        <td>${esc(food.n)}</td><td>${food.kcal} kcal</td>
        <td>${food.p} g</td><td>${food.c} g</td><td>${food.f} g</td>
      </tr>`).join('')}</tbody>
    </table>`;
}

document.getElementById('food-search').addEventListener('input', e => renderFood(e.target.value));

/* ============================================================
   搭子社群（组队训练）— 调用本地后端 /api/squad/*
   说明：需后端 node server.js 运行，小队数据在所有成员间共享。
   身份：本机生成 userId + 昵称，保存在 localStorage。
   ============================================================ */
const SQUAD_KEY = 'dxl-squad';
let squadIdentity = loadSquadIdentity();
let currentSquad = null;
let squadViewDate = todayStr();

function loadSquadIdentity() {
  try {
    const raw = localStorage.getItem(SQUAD_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return { userId: 'u_' + uid(), userName: '', squadId: '' };
}
function saveSquadIdentity() { localStorage.setItem(SQUAD_KEY, JSON.stringify(squadIdentity)); }

async function squadApi(path, body) {
  const resp = await fetch(path, body
    ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    : {});
  const result = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(result.error || '请求失败');
  return result;
}

async function renderSquad() {
  const box = document.getElementById('squad-content');
  // 已加入小队：拉取最新
  if (squadIdentity.squadId) {
    box.innerHTML = '<div class="card"><div class="empty">加载中…</div></div>';
    try {
      const { squad } = await squadApi(`/api/squad/get?id=${encodeURIComponent(squadIdentity.squadId)}`);
      currentSquad = squad;
      renderSquadView();
    } catch (e) {
      if (/不存在/.test(e.message)) { squadIdentity.squadId = ''; saveSquadIdentity(); return renderSquad(); }
      box.innerHTML = squadErrorCard(e.message);
    }
    return;
  }
  // 未加入：创建 / 加入
  box.innerHTML = `
    <div class="card">
      <h2>找个搭子，一起练</h2>
      <p class="hint">创建小队或用邀请码加入。加入后，队长可编辑每天的训练计划，队员都能看到。</p>
      <div class="form-row">
        <label>你的昵称</label>
        <input type="text" id="squad-name-input" maxlength="20" placeholder="例如：阿德" value="${esc(squadIdentity.userName)}">
      </div>
    </div>
    <div class="card">
      <h2>创建小队</h2>
      <div class="form-row">
        <label>小队名称</label>
        <input type="text" id="squad-create-name" maxlength="30" placeholder="例如：周末撸铁团">
      </div>
      <button class="btn primary" id="squad-create-btn">创建并成为队长</button>
    </div>
    <div class="card">
      <h2>加入小队</h2>
      <div class="form-row">
        <label>邀请码（6 位）</label>
        <input type="text" id="squad-join-code" maxlength="6" placeholder="例如：A1B2C3" style="text-transform:uppercase">
      </div>
      <button class="btn primary" id="squad-join-btn">加入</button>
    </div>`;

  document.getElementById('squad-create-btn').addEventListener('click', () => doCreateOrJoin('create'));
  document.getElementById('squad-join-btn').addEventListener('click', () => doCreateOrJoin('join'));
}

function readSquadName() {
  const n = document.getElementById('squad-name-input').value.trim();
  if (n) { squadIdentity.userName = n; saveSquadIdentity(); }
  return squadIdentity.userName;
}

async function doCreateOrJoin(kind) {
  const userName = readSquadName();
  if (!userName) { alert('请先填写你的昵称'); return; }
  try {
    let result;
    if (kind === 'create') {
      const name = document.getElementById('squad-create-name').value.trim();
      if (!name) { alert('请填写小队名称'); return; }
      result = await squadApi('/api/squad/create', { name, userId: squadIdentity.userId, userName });
    } else {
      const code = document.getElementById('squad-join-code').value.trim().toUpperCase();
      if (!code) { alert('请填写邀请码'); return; }
      result = await squadApi('/api/squad/join', { code, userId: squadIdentity.userId, userName });
    }
    squadIdentity.squadId = result.squad.id; saveSquadIdentity();
    currentSquad = result.squad;
    renderSquadView();
  } catch (e) {
    alert(e.message);
  }
}

function renderSquadView() {
  const s = currentSquad;
  const box = document.getElementById('squad-content');
  const captain = isSquadCaptain();
  const plan = s.plans[squadViewDate];
  const captainName = (s.members.find(m => m.id === s.captainId) || {}).name || '队长';

  box.innerHTML = `
    <div class="card">
      <div class="head" style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
        <div>
          <div class="name" style="font-size:1.15rem;font-weight:600">${esc(s.name)}
            ${captain ? '<span class="goal-tag">队长</span>' : ''}</div>
          <div class="hint" style="margin:6px 0 0">邀请码 <b class="squad-code">${esc(s.code)}</b> · ${s.members.length} 人</div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn small" id="squad-refresh">刷新</button>
          <button class="btn small danger" id="squad-leave">退出</button>
        </div>
      </div>
      <div class="squad-members">${s.members.map(m =>
        `<span class="member-chip${m.id === s.captainId ? ' captain' : ''}">${esc(m.name)}${m.id === s.captainId ? ' ⭐' : ''}</span>`).join('')}</div>
    </div>

    <div class="card">
      <h2>当天训练计划</h2>
      <div class="form-row">
        <label>日期</label>
        <input type="date" id="squad-date" value="${squadViewDate}">
      </div>
      ${captain ? `
        <div class="form-row">
          <label>训练计划（队长编辑，全队可见）</label>
          <textarea id="squad-plan-text" rows="6" placeholder="例如：\n胸 + 三头\n1. 杠铃卧推 4×6-8 @RPE8\n2. 上斜哑铃卧推 3×8-10\n3. 绳索夹胸 3×12-15\n组间休息 2-3 分钟">${esc(plan ? plan.text : '')}</textarea>
        </div>
        <button class="btn primary" id="squad-save-plan">保存计划</button>
      ` : `
        ${plan
          ? `<div class="content" style="white-space:pre-wrap">${esc(plan.text)}</div>
             <div class="source">由 ${esc(plan.updatedBy)} 更新于 ${esc((plan.updatedAt || '').slice(0, 16).replace('T', ' '))}</div>`
          : `<div class="empty">${esc(captainName)} 还没有安排这一天的训练</div>`}
      `}
    </div>`;

  document.getElementById('squad-refresh').addEventListener('click', renderSquad);
  document.getElementById('squad-leave').addEventListener('click', doLeaveSquad);
  document.getElementById('squad-date').addEventListener('change', e => {
    squadViewDate = e.target.value || todayStr();
    renderSquadView();
  });
  if (captain) {
    document.getElementById('squad-save-plan').addEventListener('click', doSavePlan);
  }
}

function isSquadCaptain() { return currentSquad && currentSquad.captainId === squadIdentity.userId; }

async function doSavePlan() {
  const text = document.getElementById('squad-plan-text').value;
  try {
    const { squad } = await squadApi('/api/squad/plan', {
      squadId: currentSquad.id, userId: squadIdentity.userId,
      userName: squadIdentity.userName, date: squadViewDate, text,
    });
    currentSquad = squad;
    renderSquadView();
    alert('已保存，队员刷新即可看到。');
  } catch (e) { alert(e.message); }
}

async function doLeaveSquad() {
  if (!confirm('确定退出该小队？')) return;
  try {
    await squadApi('/api/squad/leave', { squadId: currentSquad.id, userId: squadIdentity.userId });
  } catch (e) { /* 忽略，本地仍清理 */ }
  squadIdentity.squadId = ''; saveSquadIdentity();
  currentSquad = null;
  renderSquad();
}

function squadErrorCard(msg) {
  return `<div class="card"><div class="content" style="color:var(--danger)">
    无法连接社群服务：${esc(msg)}<br><br>
    「搭子」社群需要后端运行。请在电脑上用 <code>node server.js</code> 启动，
    手机与电脑连同一 WiFi 后访问。直接双击网页或用纯静态服务器时，社群功能不可用。
  </div></div>`;
}

/* ---------- 初始化（仅渲染首屏“训练”页，其余按需渲染，加快打开速度） ---------- */
document.getElementById('session-date').value = todayStr();
fillGoalSelect();
renderPrograms();
renderSessions();
