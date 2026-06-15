/* ============================================================
   健身训练记录 — 本地存储 (localStorage) 单页应用
   数据结构：
   - programs: [{ id, name, exercises: [string] }]
   - sessions: [{ id, programId, programName, date,
                  exercises: [{ id, name, sets: [{reps, weight}] }] }]
   - tips: [{ id, title, category, content }]
   ============================================================ */

const STORE_KEY = 'fitness-tracker-v1';

const DEFAULT_DATA = {
  programs: [
    { id: uid(), name: '胸部训练', exercises: ['杠铃卧推', '哑铃飞鸟', '上斜卧推'] },
    { id: uid(), name: '腿部训练', exercises: ['深蹲', '腿举', '罗马尼亚硬拉'] },
    { id: uid(), name: '肩部训练', exercises: ['坐姿推举', '侧平举', '面拉'] },
    { id: uid(), name: '功能性训练', exercises: ['壶铃摆动', '农夫行走', '波比跳'] },
    { id: uid(), name: '手臂训练', exercises: ['杠铃弯举', '绳索下压', '锤式弯举'] },
  ],
  sessions: [],
  tips: [
    { id: uid(), title: '复合动作组数建议', category: '组数建议',
      content: '大肌群复合动作（深蹲、卧推、硬拉）建议 3-5 组，每组 5-8 次，注重重量与渐进超负荷。' },
    { id: uid(), title: '孤立动作组数建议', category: '组数建议',
      content: '孤立动作（飞鸟、侧平举、弯举）建议 3-4 组，每组 10-15 次，注重肌肉收缩感受。' },
    { id: uid(), title: '训练前热身', category: '训练要点',
      content: '正式组前用 40%-60% 重量做 1-2 个热身组，激活目标肌群并保护关节。' },
    { id: uid(), title: '呼吸节奏', category: '关键技巧',
      content: '发力时呼气，还原时吸气；大重量可使用瓦式呼吸稳定核心。' },
  ],
};

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
  list.innerHTML = data.programs.map(p => `
    <div class="program-item">
      <div class="head">
        <div>
          <div class="name">${esc(p.name)}</div>
          <div class="ex-list">${p.exercises.length ? esc(p.exercises.join(' · ')) : '（暂无预设动作）'}</div>
        </div>
        <button class="btn small danger" data-del-program="${p.id}">删除</button>
      </div>
    </div>`).join('');

  list.querySelectorAll('[data-del-program]').forEach(b => {
    b.addEventListener('click', () => {
      if (confirm('确定删除该训练项目？已有记录不受影响。')) {
        data.programs = data.programs.filter(p => p.id !== b.dataset.delProgram);
        save(); renderPrograms();
      }
    });
  });
}

document.getElementById('add-program').addEventListener('click', () => {
  const name = document.getElementById('program-name').value.trim();
  if (!name) { alert('请输入项目名称'); return; }
  const exercises = document.getElementById('program-exercises').value
    .split(/[,，]/).map(s => s.trim()).filter(Boolean);
  data.programs.push({ id: uid(), name, exercises });
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
  list.innerHTML = data.sessions.map(s => `
    <div class="session" data-session="${s.id}">
      <div class="session-head">
        <div>
          <div class="title">${esc(s.programName)}</div>
          <div class="meta">${esc(s.date)} · ${s.exercises.length} 个动作</div>
        </div>
        <button class="btn small danger" data-del-session="${s.id}">删除</button>
      </div>
      <div class="session-body">
        ${s.exercises.map(ex => renderExercise(s.id, ex)).join('')}
        <div class="inline-form">
          <input type="text" placeholder="添加动作名称，例如：杠铃卧推" data-add-ex-input="${s.id}">
          <button class="btn small" data-add-ex="${s.id}">+ 动作</button>
        </div>
      </div>
    </div>`).join('');

  bindSessionEvents();
}

function renderExercise(sessionId, ex) {
  const rows = ex.sets.map((set, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><input type="number" min="0" value="${set.weight ?? ''}" placeholder="kg"
            data-set-weight="${sessionId}|${ex.id}|${i}"></td>
      <td><input type="number" min="0" value="${set.reps ?? ''}" placeholder="次"
            data-set-reps="${sessionId}|${ex.id}|${i}"></td>
      <td><button class="btn small danger" data-del-set="${sessionId}|${ex.id}|${i}">×</button></td>
    </tr>`).join('');

  return `
    <div class="exercise">
      <div class="exercise-head">
        <span class="name">${esc(ex.name)}</span>
        <button class="btn small danger" data-del-ex="${sessionId}|${ex.id}">删除动作</button>
      </div>
      ${overloadHint(sessionId, ex.name)}
      ${ex.sets.length ? `
      <table class="sets-table">
        <thead><tr><th>组</th><th>重量</th><th>次数</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>` : '<div class="hint" style="margin:0">还没有记录组数</div>'}
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
      ex.sets.push({ weight: '', reps: '' });
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
      save();
    }));

  list.querySelectorAll('[data-set-reps]').forEach(inp =>
    inp.addEventListener('change', () => {
      const [sid, exid, i] = inp.dataset.setReps.split('|');
      findEx(sid, exid).sets[Number(i)].reps = inp.value;
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
    .filter(s => s.exercises.some(e => e.name === exName && e.sets.some(set => Number(set.weight) > 0 || Number(set.reps) > 0)))
    .sort((a, b) => b.date.localeCompare(a.date));
  if (!candidates.length) return null;
  const prev = candidates[0];
  const ex = prev.exercises.find(e => e.name === exName);
  // 取重量最大的一组
  let best = null;
  ex.sets.forEach(set => {
    const w = Number(set.weight) || 0, r = Number(set.reps) || 0;
    if (!best || w > best.w || (w === best.w && r > best.r)) best = { w, r };
  });
  return { date: prev.date, best };
}

function overloadHint(sessionId, exName) {
  const prev = findPrevExercisePerf(sessionId, exName);
  if (!prev || !prev.best || prev.best.w === 0) return '';
  const { w, r } = prev.best;
  const suggestW = Math.round((w + 2.5) * 10) / 10;
  return `<div class="overload-hint">上次 (${esc(prev.date)})：最重 ${w}kg × ${r}次　·
    建议本次尝试 <b>${suggestW}kg</b> 或在 ${w}kg 下多做 1-2 次（渐进超负荷）</div>`;
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
    date,
    exercises: last.exercises.map(ex => ({
      id: uid(),
      name: ex.name,
      sets: ex.sets.map(set => ({ weight: set.weight, reps: set.reps })),
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

function renderTips() {
  const list = document.getElementById('tips-list');
  const items = data.tips.filter(t => tipFilter === '全部' || t.category === tipFilter);
  if (!items.length) {
    list.innerHTML = '<div class="empty">还没有训练要点，添加一条吧。</div>';
    return;
  }
  list.innerHTML = items.map(t => `
    <div class="tip-item">
      <div class="head">
        <div>
          <span class="badge ${t.category}">${esc(t.category)}</span>
          <div class="title">${esc(t.title)}</div>
        </div>
        <button class="btn small danger" data-del-tip="${t.id}">删除</button>
      </div>
      <div class="content">${esc(t.content)}</div>
    </div>`).join('');

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
  const box = document.getElementById('progress-chart');
  if (!name) { box.innerHTML = '<div class="empty">暂无数据</div>'; return; }
  const rows = data.sessions
    .filter(s => s.exercises.some(e => e.name === name))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(s => {
      const ex = s.exercises.find(e => e.name === name);
      const maxW = Math.max(0, ...ex.sets.map(set => Number(set.weight) || 0));
      return { label: s.date.slice(5), value: maxW, display: maxW + ' kg' };
    })
    .filter(r => r.value > 0)
    .slice(-10);
  box.innerHTML = barChart(rows);
}

document.getElementById('progress-exercise').addEventListener('change', renderProgressChart);

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

/* ---------- 选项卡切换时刷新统计 ---------- */
document.querySelector('.tab-btn[data-tab="stats"]').addEventListener('click', renderStats);

/* ---------- 初始化 ---------- */
document.getElementById('session-date').value = todayStr();
renderPrograms();
renderSessions();
renderTips();
renderStats();
