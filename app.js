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

/* ---------- 初始化 ---------- */
document.getElementById('session-date').value = todayStr();
renderPrograms();
renderSessions();
renderTips();
