# 组间休息计时器 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为「德训录」增加一个手动触发、固定 90s、底部悬浮条形式的组间休息倒计时器。

**Architecture:** 纯前端、无框架、单文件 `app.js`。新增一个全局单例 `restTimer`（闭包模块），渲染到一个独立于训练列表的固定定位容器 `#rest-timer`（`<body>` 直接子节点，不受 `renderSessions` 重渲染/切 tab/滚动影响）。计时基于目标结束时间戳 `endAt`，每秒 tick 重算剩余。每个动作的"+添加一组"行旁加 `⏱ 休息` 按钮，事件在已有的 `bindSessionEvents` 里委托绑定。

**Tech Stack:** 原生 JS / DOM / CSS；测试用 jsdom（`/tmp/domtest`，node 脚本，`cd /tmp/domtest && node tN.js`）。

## Global Constraints

- 单文件 `app.js`、`index.html`、`styles.css`，无构建步骤、无新依赖。
- 中文 UI 文案；现有深色 + 液态银主题与 `--silver-shimmer` 变量复用。
- 复用现有 `toast(message, kind)`（app.js:124 附近）。
- 计时纯内存，**不写 localStorage**。
- 全局单实例：再次 `start()` 直接重置。
- 提交邮箱 `noreply@anthropic.com`（已配 git config）。
- jsdom 测试不得有 `TOTAL ERRORS`。
- `prefers-reduced-motion` 下进度条不做过渡动画。

---

### Task 1: restTimer 核心模块（无 DOM，纯状态机 + 可测）

**Files:**
- Modify: `app.js`（在 `toast()` 定义之后、`emptyState()` 之前插入 restTimer 模块）
- Test: `/tmp/domtest/t-rest.js`（新建）

**Interfaces:**
- Produces: 全局 `restTimer` 对象，方法：
  - `restTimer.start(seconds = 90)` — 重置并开始；创建/显示悬浮条
  - `restTimer.pause()` / `restTimer.resume()`
  - `restTimer.skip()` — 停止并移除悬浮条
  - `restTimer.adjust(deltaSeconds)` — ±时间；降到 0 视为结束
  - `restTimer.remainingMs()` — 返回当前剩余毫秒（测试用）
  - `restTimer.isRunning()` — bool（测试用）
- 内部依赖：`toast()`、`document`、`navigator.vibrate`、`AudioContext`。
- 为可测，tick 用 `restTimer._tick()` 暴露（手动驱动），并允许注入 `restTimer._now = () => ms` 覆盖时间源（默认 `Date.now`）。

- [ ] **Step 1: 写失败测试** — 新建 `/tmp/domtest/t-rest.js`

```js
const fs=require('fs'); const {JSDOM}=require('jsdom');
const html=fs.readFileSync('/home/user/jizhang/index.html','utf8');
const js=fs.readFileSync('/home/user/jizhang/app.js','utf8');
function boot(){
  const dom=new JSDOM(html,{runScripts:'outside-only',pretendToBeVisual:true,url:'https://x.onrender.com/'});
  let errs=0; dom.window.onerror=(m)=>{errs++;console.log('ERR',m);};
  dom.window.eval(js);
  return {w:dom.window, D:dom.window.document, errs:()=>errs};
}
let pass=0, fail=0;
const ok=(name,cond)=>{ (cond?pass++:fail++); console.log((cond?'✓':'✗')+' '+name); };

// 用可注入时间源驱动
{
  const {w,D,errs}=boot();
  const rt=w.restTimer;
  let now=1_000_000;
  rt._now=()=>now;
  rt.start(90);
  ok('start 后 running', rt.isRunning());
  ok('start 后悬浮条出现', !!D.getElementById('rest-timer') && D.getElementById('rest-timer').classList.contains('on'));
  ok('剩余约 90s', Math.round(rt.remainingMs()/1000)===90);
  // 前进 30s
  now += 30000; rt._tick();
  ok('30s 后剩余 60s', Math.round(rt.remainingMs()/1000)===60);
  // +30 调整
  rt.adjust(30);
  ok('+30 后剩余 90s', Math.round(rt.remainingMs()/1000)===90);
  // -30 调整
  rt.adjust(-30);
  ok('-30 后剩余 60s', Math.round(rt.remainingMs()/1000)===60);
  // 暂停 → 时间前进不应减少剩余
  rt.pause();
  now += 10000; rt._tick();
  ok('暂停后剩余不变 60s', Math.round(rt.remainingMs()/1000)===60);
  rt.resume();
  now += 20000; rt._tick();
  ok('继续后剩余 40s', Math.round(rt.remainingMs()/1000)===40);
  // skip → 移除
  rt.skip();
  ok('skip 后不再 running', !rt.isRunning());
  ok('skip 后悬浮条移除', !D.getElementById('rest-timer') || !D.getElementById('rest-timer').classList.contains('on'));
  console.log('ERRORS', errs());
}
// 归零行为
{
  const {w,D}=boot();
  const rt=w.restTimer; let now=5_000_000; rt._now=()=>now;
  rt.start(90);
  now += 91000; rt._tick();
  ok('归零后不再 running', !rt.isRunning());
  ok('归零触发 toast', D.querySelectorAll('#toast-host .toast').length>=1);
  ok('归零移除悬浮条', !D.getElementById('rest-timer') || !D.getElementById('rest-timer').classList.contains('on'));
}
console.log(`\n${pass} passed, ${fail} failed`);
if(fail) process.exit(1);
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd /tmp/domtest && node t-rest.js`
Expected: 报错或多条 ✗（`restTimer` 未定义 → `Cannot read properties of undefined`）。

- [ ] **Step 3: 写最小实现** — 在 `app.js` 中 `toast(...)` 函数定义之后插入：

```js
/* ---------- 组间休息计时器（全局单例，纯内存） ---------- */
const restTimer = (() => {
  let endAt = 0;          // 目标结束时间戳(ms)
  let remaining = 0;      // 暂停时保存的剩余(ms)
  let paused = false;
  let running = false;
  let intervalId = null;
  const DEFAULT = 90;

  const api = {
    _now: () => Date.now(),
    isRunning: () => running,
    remainingMs: () => paused ? remaining : Math.max(0, endAt - api._now()),

    start(seconds = DEFAULT) {
      clearInterval(intervalId);
      running = true; paused = false;
      endAt = api._now() + seconds * 1000;
      ensureBar();
      paint();
      intervalId = setInterval(() => api._tick(), 250);
    },
    pause() {
      if (!running || paused) return;
      remaining = api.remainingMs();
      paused = true;
      clearInterval(intervalId);
      paint();
    },
    resume() {
      if (!running || !paused) return;
      endAt = api._now() + remaining;
      paused = false;
      intervalId = setInterval(() => api._tick(), 250);
      paint();
    },
    adjust(deltaSeconds) {
      if (!running) return;
      if (paused) {
        remaining = Math.max(0, remaining + deltaSeconds * 1000);
        if (remaining === 0) return finish();
      } else {
        endAt += deltaSeconds * 1000;
        if (api.remainingMs() === 0) return finish();
      }
      paint();
    },
    skip() { teardown(); },

    _tick() {
      if (!running || paused) return;
      if (api.remainingMs() <= 0) return finish();
      paint();
    },
  };

  function finish() {
    teardown();
    try { navigator.vibrate && navigator.vibrate([200]); } catch (e) {}
    beep();
    toast('休息结束', 'success');
  }
  function teardown() {
    running = false; paused = false;
    clearInterval(intervalId); intervalId = null;
    const bar = document.getElementById('rest-timer');
    if (bar) bar.classList.remove('on');
  }
  function beep() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880; osc.type = 'sine';
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.32);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.34);
    } catch (e) { /* 移动端可能拦截，静默 */ }
  }

  // DOM 在 Task 2 接入；此处先放占位，Task 2 替换
  function ensureBar() {}
  function paint() {}

  // 暴露给 Task 2 覆盖
  api._setRenderers = (mkBar, mkPaint) => { ensureBar = mkBar; paint = mkPaint; };
  return api;
})();
```

- [ ] **Step 4: 运行测试**

Run: `cd /tmp/domtest && node t-rest.js`
Expected: 计时/调整/暂停/继续/skip/归零 相关断言 PASS；但与 `#rest-timer` DOM/`.on` 类、toast 相关的断言**可能仍 ✗**（因为 ensureBar/paint 还是空、bar 不存在）。归零的 toast 断言应 PASS（finish 调 toast）。记录当前通过数，DOM 类相关留给 Task 2。

> 说明：本任务只锁定状态机正确性。`#rest-timer` 出现/移除 的断言会在 Task 2 实现 DOM 后转绿。先确保「时间数学」全绿。

- [ ] **Step 5: 提交**

```bash
cd /home/user/jizhang
git add app.js
git commit -m "feat(rest-timer): 计时核心状态机(start/pause/resume/adjust/skip/归零)"
```

---

### Task 2: 悬浮条 DOM + 渲染/控制接线

**Files:**
- Modify: `index.html`（在 `#toast-host` 之后加 `#rest-timer` 容器）
- Modify: `app.js`（实现 `ensureBar`/`paint`，通过 `restTimer._setRenderers` 注入；绑定按钮）
- Test: `/tmp/domtest/t-rest.js`（复用 Task 1，现在 DOM 相关断言应转绿）

**Interfaces:**
- Consumes: `restTimer.start/pause/resume/adjust/skip/remainingMs/isRunning`（Task 1）
- Produces: DOM `#rest-timer`，含 `.rest-bar-fill`（进度）、`.rest-time`（MM:SS）、按钮 `[data-rest="minus"|"toggle"|"skip"|"plus"]`。`restTimer.start()` 后该容器 `.on`。

- [ ] **Step 1: 写失败测试** — 在 `/tmp/domtest/t-rest.js` 末尾追加（按钮交互 + 显示）：

```js
// 追加：DOM 控制与显示
{
  const {w,D}=boot();
  const rt=w.restTimer; let now=2_000_000; rt._now=()=>now;
  rt.start(90);
  const bar=D.getElementById('rest-timer');
  ok('悬浮条含时间文本 01:30', bar.querySelector('.rest-time').textContent==='01:30');
  // 点 +30 按钮
  bar.querySelector('[data-rest="plus"]').dispatchEvent(new w.Event('click',{bubbles:true}));
  ok('点+30 → 02:00', bar.querySelector('.rest-time').textContent==='02:00');
  // 点暂停
  bar.querySelector('[data-rest="toggle"]').dispatchEvent(new w.Event('click',{bubbles:true}));
  now += 5000;
  bar.querySelector('[data-rest="minus"]').dispatchEvent(new w.Event('click',{bubbles:true})); // -30 在暂停态
  ok('暂停态 -30 → 01:30', bar.querySelector('.rest-time').textContent==='01:30');
  // 点跳过
  bar.querySelector('[data-rest="skip"]').dispatchEvent(new w.Event('click',{bubbles:true}));
  ok('跳过后隐藏', !bar.classList.contains('on'));
}
```

- [ ] **Step 2: 运行确认失败**

Run: `cd /tmp/domtest && node t-rest.js`
Expected: 新增断言 ✗（`.rest-time` 为 null / `#rest-timer` 不存在）。

- [ ] **Step 3a: 加 DOM 容器** — `index.html`，在 `<div id="toast-host" aria-live="polite"></div>` 之后插入：

```html
<div id="rest-timer" aria-live="off"></div>
```

- [ ] **Step 3b: 实现渲染与接线** — `app.js`，在 `restTimer` IIFE `return api;` 之前、`api._setRenderers(...)` 调用处替换为真实实现。即把 Task 1 里的占位 `ensureBar`/`paint` 替换为：

```js
  function fmt(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(s / 60);
    return `${String(m).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;
  }
  let totalMs = 90000;   // 当前这轮的总时长，用于进度条比例
  function ensureBar() {
    let bar = document.getElementById('rest-timer');
    if (!bar) return;            // index.html 容器必然存在
    totalMs = api.remainingMs() || 90000;
    bar.classList.add('on');
    bar.innerHTML = `
      <div class="rest-progress"><span class="rest-bar-fill"></span></div>
      <div class="rest-row">
        <button class="rest-btn" data-rest="minus">−30</button>
        <span class="rest-time">--:--</span>
        <button class="rest-btn rest-toggle" data-rest="toggle">⏸</button>
        <button class="rest-btn" data-rest="skip">跳过 ✕</button>
        <button class="rest-btn" data-rest="plus">+30</button>
      </div>`;
    bar.onclick = (e) => {
      const b = e.target.closest('[data-rest]'); if (!b) return;
      const act = b.dataset.rest;
      if (act === 'minus') api.adjust(-30);
      else if (act === 'plus') api.adjust(30);
      else if (act === 'skip') api.skip();
      else if (act === 'toggle') paused ? api.resume() : api.pause();
    };
  }
  function paint() {
    const bar = document.getElementById('rest-timer');
    if (!bar || !bar.classList.contains('on')) return;
    const rem = api.remainingMs();
    const t = bar.querySelector('.rest-time');
    if (t) t.textContent = fmt(rem);
    const fill = bar.querySelector('.rest-bar-fill');
    if (fill) fill.style.width = Math.max(0, Math.min(100, rem / totalMs * 100)) + '%';
    const tog = bar.querySelector('.rest-toggle');
    if (tog) tog.textContent = paused ? '▶' : '⏸';
  }
```

并删除 Task 1 里 `api._setRenderers = ...` 那一行（不再需要注入机制，直接用真实函数）。同时在 `start()`/`adjust()` 调 `ensureBar()` 时确保 `totalMs` 更新：在 `start()` 内 `ensureBar()` 之前加 `totalMs = seconds * 1000;`，在 `adjust()` 末尾（paint 之前）加 `if (api.remainingMs() > totalMs) totalMs = api.remainingMs();`。

> 注意：`fmt` 用 `Math.ceil`，使 90000ms 显示 `01:30`、刚跨过整秒不会瞬间跳。

- [ ] **Step 4: 运行测试**

Run: `cd /tmp/domtest && node t-rest.js`
Expected: 全部 ✓（含 Task 1 里之前留绿的 DOM 断言），`ERRORS 0`，结尾 `N passed, 0 failed`。

- [ ] **Step 5: 提交**

```bash
cd /home/user/jizhang
git add app.js index.html
git commit -m "feat(rest-timer): 底部悬浮条 DOM + 进度/控制接线"
```

---

### Task 3: 「⏱ 休息」按钮接入动作卡 + CSS 样式

**Files:**
- Modify: `app.js`（`renderExercise` 的 `.set-add-row`：加按钮；`bindSessionEvents`：绑定 `[data-rest-start]`）
- Modify: `styles.css`（`#rest-timer` 悬浮条样式 + reduced-motion）
- Test: `/tmp/domtest/t-rest.js`（追加：按钮触发 + 无自动启动）

**Interfaces:**
- Consumes: `restTimer.start()`（Task 1/2）
- Produces: 每个动作 `.set-add-row` 内新增 `<button data-rest-start>⏱ 休息</button>`；点击 → `restTimer.start(90)`。

- [ ] **Step 1: 写失败测试** — 在 `/tmp/domtest/t-rest.js` 末尾追加：

```js
// 追加：动作卡按钮触发 + 确认无自动启动
{
  const {w,D}=boot();
  const today=new Date().toISOString().slice(0,10);
  w.localStorage.setItem('fitness-tracker-v1', JSON.stringify({
    programs:[{id:'p',name:'胸',goal:'增肌',exercises:['卧推']}],
    sessions:[{id:'s',programId:'p',programName:'胸',goal:'增肌',date:today,
      exercises:[{id:'e',name:'卧推',sets:[{weight:'',reps:'',rpe:''}]}]}],
    tips:[], profile:{}
  }));
  w.eval(js);
  const D2=w.document;
  // 改 reps 不应启动计时
  const r=D2.querySelector('#today-list [data-set-reps]');
  r.value='10'; r.dispatchEvent(new w.Event('change',{bubbles:true}));
  ok('改 reps 不自动启动计时', !w.restTimer.isRunning());
  // 点 ⏱休息 按钮启动
  const btn=D2.querySelector('#today-list [data-rest-start]');
  ok('动作卡有休息按钮', !!btn);
  btn.dispatchEvent(new w.Event('click',{bubbles:true}));
  ok('点休息按钮启动计时', w.restTimer.isRunning());
  ok('悬浮条显示 01:30', D2.getElementById('rest-timer').querySelector('.rest-time').textContent==='01:30');
  w.restTimer.skip();
}
```

- [ ] **Step 2: 运行确认失败**

Run: `cd /tmp/domtest && node t-rest.js`
Expected: `动作卡有休息按钮` ✗（按钮还没加）。

- [ ] **Step 3a: 加按钮** — `app.js` `renderExercise` 中把 `.set-add-row` 块改为：

```js
      <div class="set-add-row">
        <button class="btn small primary" data-add-set="${sessionId}|${ex.id}">+ 添加一组</button>
        <button class="btn small" data-rest-start>⏱ 休息</button>
      </div>
```

- [ ] **Step 3b: 绑定按钮** — `app.js` `bindSessionEvents` 内（紧跟 `[data-empty-action]` 绑定之后）加：

```js
  // 组间休息：点 ⏱休息 启动 90s 计时
  list.querySelectorAll('[data-rest-start]').forEach(b =>
    b.addEventListener('click', () => restTimer.start(90)));
```

- [ ] **Step 3c: 加 CSS** — `styles.css` 末尾追加：

```css
/* ---------- 组间休息计时器悬浮条 ---------- */
#rest-timer {
  position: fixed;
  left: 50%; bottom: 84px;
  transform: translateX(-50%);
  width: min(440px, calc(100% - 24px));
  background: linear-gradient(135deg, #1c222c 0%, #161a22 100%);
  border: 1px solid rgba(214,220,230,.22);
  border-radius: 14px;
  box-shadow: 0 10px 34px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.06);
  padding: 12px 14px 10px;
  z-index: 9998;
  opacity: 0;
  transform: translate(-50%, 16px);
  pointer-events: none;
  transition: opacity .24s ease, transform .26s cubic-bezier(.2,.7,.2,1);
}
#rest-timer.on { opacity: 1; transform: translate(-50%, 0); pointer-events: auto; }
.rest-progress { height: 4px; border-radius: 2px; background: rgba(255,255,255,.1); overflow: hidden; margin-bottom: 10px; }
.rest-bar-fill { display: block; height: 100%; width: 100%; background: var(--silver-shimmer); background-size: 300% 100%; background-position: 200% 50%; transition: width 1s linear; }
.rest-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.rest-time { font-size: 1.5rem; font-weight: 800; font-variant-numeric: tabular-nums; letter-spacing: .5px; color: var(--silver-1); min-width: 78px; text-align: center; }
.rest-btn { padding: 7px 12px; border: 1px solid var(--border); border-radius: 9px; background: var(--surface-2); color: var(--text); font-size: .85rem; font-family: inherit; cursor: pointer; transition: .15s; }
.rest-btn:active { transform: scale(.95); }
.rest-toggle { min-width: 44px; font-size: 1rem; }
@media (prefers-reduced-motion: reduce) {
  #rest-timer { transition: opacity .15s; }
  .rest-bar-fill { transition: none; }
}
```

- [ ] **Step 4: 运行测试**

Run: `cd /tmp/domtest && node t-rest.js`
Expected: 全绿，`ERRORS 0`，`N passed, 0 failed`。

- [ ] **Step 5: 回归 + 提交**

```bash
cd /tmp/domtest && node t14.js && node t15.js 2>&1 | grep -E "TOTAL|streak|passed|✓|✗" | head
cd /home/user/jizhang
node --check app.js
git add app.js styles.css
git commit -m "feat(rest-timer): 动作卡 ⏱休息 按钮 + 悬浮条样式，确认无自动启动"
```

> 回归说明：t14（局部更新/焦点）应仍全绿；t15 中 [7]/[8] 为过期断言（本周容量已移除）可忽略，其余应绿。

---

### Task 4: 推送

- [ ] **Step 1: 最终自检**

```bash
cd /home/user/jizhang && node --check app.js && echo OK
cd /tmp/domtest && node t-rest.js | tail -3
```
Expected: `OK` + `N passed, 0 failed`。

- [ ] **Step 2: 推送**

```bash
cd /home/user/jizhang
git push -u origin claude/admiring-gates-6cmukl 2>&1 | tail -3
```

---

## Self-Review

**1. Spec coverage:**
- 仅手动触发 → Task 3（按钮）+ Task 3 测试断言"改 reps 不自动启动" ✓
- 固定 90s / ±30s → Task 1 `start(90)`、`adjust` ✓
- 底部悬浮条（独立 DOM、不受重渲染影响） → Task 2（`#rest-timer` 在 `<body>`，非列表内）✓
- endAt 时间戳计时、后台节流仍正确 → Task 1 `remainingMs = endAt - now` ✓
- 暂停/继续/跳过/±30 → Task 1+2 ✓
- 归零：震动 + 提示音 + toast + 移除 → Task 1 `finish()` ✓
- 全局单实例（再次 start 重置） → Task 1 `start` 先 `clearInterval` 重置 ✓
- 纯内存不持久化 → 无 localStorage 写入 ✓
- reduced-motion 进度条不动画 → Task 3 CSS ✓
- 测试覆盖（start/调整/暂停继续/跳过/归零/按钮/无自动） → Task 1–3 测试 ✓

**2. Placeholder scan:** 无 TBD/TODO；每个代码步给出完整代码。Task 1 Step 4 明确说明哪些断言此刻留绿、Task 2 转绿，非占位而是分阶段。

**3. Type consistency:** `restTimer.start/pause/resume/adjust/skip/remainingMs/isRunning/_now/_tick` 全程一致；按钮 `data-rest`（条内控制）与 `data-rest-start`（动作卡启动）命名区分明确，无冲突。Task 2 移除 Task 1 的 `_setRenderers` 注入占位，已在 Step 3b 明确说明。
