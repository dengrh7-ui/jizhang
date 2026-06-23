# 组间休息计时器 — 设计文档

日期：2026-06-23
状态：已批准设计，待实现

## 目标

为「德训录」健身 App 增加组间休息计时器：记录完一组后，引导用户休息到合适时长再开始下一组。符合力量/增肌训练"组间休息"的真实使用习惯。

## 用户决策（已确认）

- **触发**：自动 + 手动 两者都要。
- **时长**：固定默认 90 秒，运行时可 ±30s 临时调整。
- **显示**：底部悬浮条。

## 行为规格

### 全局单实例
同一时刻只有一个计时器在跑。再次触发（自动或手动）会**重置**为新的 90s 并重新开始。

### 自动启动
- 在 **今天的训练**（`session.date === todayStr()`）里，某组的 **Reps 输入** `change` 且值为正数时，自动 `restTimer.start()`。
- 编辑 **历史记录**（非今日 session）**不触发**，避免修改旧数据时被打扰。
- 仅 Reps 触发（不在 weight 上触发），避免一组录入触发两次。

### 手动启动
- 每个动作的"+添加一组"行旁新增 `⏱ 休息` 按钮，点击立即 `start()`（重置为 90s）。

### 底部悬浮条
独立于训练列表 DOM（作为 `<body>` 直接子节点的容器），不受 `renderSessions` 重渲染 / 切 tab / 滚动影响。

包含：
- 细进度条：宽度随剩余时间收缩（100% → 0%）。
- 大号 `MM:SS` 倒计时（等宽数字）。
- 控制按钮：`−30`、`暂停/继续`、`跳过 ✕`、`+30`。

### 计时实现
- 基于**目标结束时间戳** `endAt = Date.now() + remainingMs`，每秒 tick 时计算 `remaining = endAt - Date.now()`。
- 这样手机后台 `setInterval` 被节流后，回到前台仍显示正确剩余时间（不会因丢帧而少算）。
- 暂停：记录当前 `remainingMs`，清除 interval。继续：用 `remainingMs` 重新计算 `endAt`。

### 归零行为
- `navigator.vibrate?.([200])` 震动（支持的设备）。
- 一声短促 WebAudio "嘀"（best-effort；计时由用户手势触发，AudioContext 可创建；移动端被拦截则静默失败）。
- `toast('休息结束')`。
- 悬浮条自动滑出并移除。

### 状态
纯内存（不写 localStorage）。关闭页面即清空——休息计时无需持久化。

### ±30s 边界
- `+30`：`remainingMs += 30000`，相应延后 `endAt`。
- `−30`：`remainingMs = max(remainingMs − 30000, 0)`；若降到 0 即视为结束（触发归零行为）。

## 组件边界

| 单元 | 职责 | 依赖 |
|---|---|---|
| `restTimer`（模块/闭包对象） | start / pause / resume / skip / adjust / 内部 tick；维护 `endAt`、`remainingMs`、`paused`、`intervalId` | `toast()`、DOM 悬浮条节点 |
| 悬浮条 DOM（`#rest-timer`） | 纯展示 + 控制按钮，事件委托到 restTimer | restTimer |
| `renderExercise` 改动 | 渲染 `⏱ 休息` 按钮（`data-rest-start`） | restTimer.start |
| reps `change` 处理器改动 | 今日 session 且 reps>0 → restTimer.start | restTimer.start, todayStr |

接口：`restTimer.start(seconds=90)` / `.pause()` / `.resume()` / `.skip()` / `.adjust(deltaSeconds)`。展示通过 restTimer 内部的 `paint()` 更新悬浮条；外部只调上述方法。

## 不做（YAGNI）

- 不做每动作自定义时长。
- 不做计时历史/统计。
- 默认时长不进设置页（固定 90s，临时用 ±30s）。
- 不做多计时器并行。

## 无障碍 / 性能

- `prefers-reduced-motion` 下进度条去掉 width 过渡动画。
- tick 间隔 1s，归零或跳过即 `clearInterval`，无常驻空转。

## 测试（jsdom）

- start 后悬浮条出现、显示 01:30。
- +30 → 02:00；−30 → 01:00。
- 跳过 → 悬浮条移除、interval 清除。
- 暂停后剩余不变、继续后继续递减（用可注入的 now 或快进 endAt 验证）。
- 今日 session reps change → 自动 start；历史 session reps change → **不**触发。
- 归零 → toast('休息结束') + 悬浮条移除。
- 既有回归：局部更新/焦点保留/PR/streak 不受影响。
