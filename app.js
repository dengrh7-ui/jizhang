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

/* ---------- 工具函数 ---------- */
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { console.warn('读取存储失败', e); }
  return structuredClone(DEFAULT_DATA);
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

/* ---------- 选项卡切换 ---------- */
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
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

function renderSessions() {
  const list = document.getElementById('sessions-list');
  if (!data.sessions.length) {
    list.innerHTML = '<div class="empty">还没有训练记录，创建一次训练开始记录吧。</div>';
    return;
  }
  list.innerHTML = data.sessions.map(s => {
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

  document.querySelectorAll('#cal-grid .cal-cell.has-workout').forEach(c =>
    c.addEventListener('click', () => {
      calSelected = c.dataset.date;
      renderCalendar();
      renderCalDetail();
    }));

  renderCalDetail();
}

function renderCalDetail() {
  const box = document.getElementById('cal-day-detail');
  if (!calSelected) { box.innerHTML = ''; return; }
  const sessions = data.sessions.filter(s => s.date === calSelected);
  if (!sessions.length) { box.innerHTML = ''; return; }
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
   AI 教练（运动 / 营养）— 调用本地后端 /api/coach
   ============================================================ */
let coachMode = '运动';

document.querySelectorAll('[data-coach-mode]').forEach(c =>
  c.addEventListener('click', () => {
    document.querySelectorAll('[data-coach-mode]').forEach(x => x.classList.remove('active'));
    c.classList.add('active');
    coachMode = c.dataset.coachMode;
  }));

// 把近期训练记录整理成给 Claude 的文字上下文（含 RPE 与估算 1RM）
function buildTrainingContext() {
  return data.sessions.slice(0, 5).map(s => {
    const lines = s.exercises.map(ex => {
      const done = ex.sets.filter(set => Number(set.weight) > 0 && Number(set.reps) > 0)
        .map(set => `${set.weight}kg×${set.reps}${set.rpe ? `@RPE${set.rpe}` : ''}`).join(', ');
      const best = bestSetByE1RM(ex.sets);
      const e = best ? `（≈1RM ${round1(best.e1rm)}kg）` : '';
      return `  - ${ex.name}：${done || '未记录'}${e}`;
    }).join('\n');
    return `${s.date} ${s.programName}${s.goal ? `[目标:${s.goal}]` : ''}\n${lines}`;
  }).join('\n');
}

document.getElementById('coach-send').addEventListener('click', async () => {
  const input = document.getElementById('coach-input');
  const message = input.value.trim();
  const box = document.getElementById('coach-response');
  if (!message) { alert('请输入问题'); return; }

  const useData = document.getElementById('coach-use-data').checked;
  box.innerHTML = '<div class="card"><div class="empty">正在思考…</div></div>';

  try {
    const resp = await fetch('/api/coach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: coachMode,
        message,
        context: useData ? buildTrainingContext() : '',
      }),
    });
    const result = await resp.json();
    if (!resp.ok) throw new Error(result.error || '请求失败');
    box.innerHTML = `<div class="card">
      <span class="badge 训练要点">${esc(coachMode)}建议</span>
      <div class="content" style="white-space:pre-wrap;font-size:.92rem;margin-top:6px">${esc(result.text)}</div>
    </div>`;
  } catch (e) {
    box.innerHTML = `<div class="card"><div class="content" style="color:var(--danger)">
      出错了：${esc(e.message)}<br><br>
      若提示无法连接，请确认已用 <code>node server.js</code> 启动后端，
      并配置了 ANTHROPIC_API_KEY（详见 README）。直接用 python 静态服务器或双击打开时，AI 助手不可用。
    </div></div>`;
  }
});

/* ---------- 选项卡切换时刷新对应内容 ---------- */
document.querySelector('.tab-btn[data-tab="stats"]').addEventListener('click', renderStats);
document.querySelector('.tab-btn[data-tab="calendar"]').addEventListener('click', renderCalendar);

/* ---------- 初始化 ---------- */
document.getElementById('session-date').value = todayStr();
fillGoalSelect();
renderPrograms();
renderSessions();
renderTips();
renderStats();
renderCalendar();
