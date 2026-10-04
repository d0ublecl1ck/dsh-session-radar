<sub>🌐 <b>中文</b> · <a href="#english">English</a></sub>

<div align="center">

# dsh-session-radar

> *「重启也不丢的未读，和正在等你的那一个。」*

[![npm version](https://img.shields.io/npm/v/dsh-session-radar)](https://www.npmjs.com/package/dsh-session-radar)
[![npm downloads](https://img.shields.io/npm/dm/dsh-session-radar)](https://www.npmjs.com/package/dsh-session-radar)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![DSH plugin](https://img.shields.io/badge/DSH-plugin-4f46e5)](https://github.com/deepseek-ai/deepseek-harness)

**DSH 侧边栏的未读与待办中枢：`⌘⇧J` 按顺序定位未读会话，`⌘⇧I` 处理正在等你输入的会话（提问 / 审批 / 计划审阅），`⌘⇧K` 弹出「等你处理」总览——所有未读与待决策的会话分成两区铺成卡片网格，一眼看清还欠多少；账本落在 host 半边，重启也不丢。侧边栏底部另有一行六项会话状态读数，设置页可逐项开关。**

[效果](#效果) · [安装](#安装) · [装完怎么确认](#装完怎么确认) · [怎么用](#怎么用) · [等你处理总览](#等你处理总览k) · [会话状态读数](#会话状态读数六项计数) · [已知限制](#已知限制) · [安全边界](#安全边界) · [文件结构](#文件结构) · [兼容性](#兼容性) · [开发](#开发)

</div>

---

![侧边栏铃铛：红色未读角标 + 黄色等待处理角标](assets/bell.png)

---

## 它解决什么问题

同时开着四五个 DSH 会话，你去泡了杯咖啡回来——哪个跑完了？哪个正在等你点确认？

侧边栏默认列表不回答这两个问题；官方那个红点只在浏览器标签上闪一下，刷新、重启就没了。

这个插件把两件事搬回侧边栏：

- 一个**红色角标**告诉你还欠几个「跑完没看」的会话，`⌘⇧J` 带你按顺序一个个过；
- 一个**黄色角标**（铃铛左上角）告诉你谁在**等你输入**——提问、审批、计划审阅都算，`⌘⇧I` 带你处理，处理完再按一下会**原路返回**；
- 想知道**总账**时按 `⌘⇧K`：所有未读与待决策的会话在一个弹窗里铺成两区网格，不用一个接一个按过去才知道还有多少；
- 两者的账本由 host 半边持有，写进 `$DSH_HOME/session-radar.json`，**重启 dsh 后欠的账还在**。

## 效果

未读和「等待你处理」是两个独立角标——右上红色是跑完没看的，左上黄色是等你输入的，同时出现也互不顶掉：

![铃铛：左上黄色等待处理角标 + 右上红色未读角标](assets/ask-badge.png)

- `⌘⇧J`：按顺序走未读会话，走到末尾绕回第一个；
- `⌘⇧I`：先走等待项（最早开始等待的排最前），处理完再按就跳到下一个；没有等待项了，再按会**沿原路返回**你上一个停留点；
- `⌘⇧K`：弹出「等你处理」总览——左边一列是**待决策**（提问 / 审批 / 计划审阅），右边网格是**未读**，方向键选、Enter 打开、再按一次 `⌘⇧K` 或 Esc 关掉。

## 安装

三档，任选一条。

### npm（推荐）

```sh
dsh plugin --profile web add dsh-session-radar
```

### GitHub

```sh
dsh plugin --profile web add github:d0ublecl1ck/dsh-session-radar
```

仓库把构建产物 `lib/` 一起提交了，git 安装不需要本地 build。

### 本地目录

```sh
dsh plugin --profile web add /绝对路径/dsh-session-radar
```

### 装完让它生效

1. 页面开着的话刷新一下；
2. 卸载：`dsh plugin --profile web remove dsh-session-radar`。

> **改了 host 半边（`src/host.ts`）之后必须 `remove` + `add`**：宿主按 URL 缓存模块，只 `add` 不会重新导入；症状是"改了没生效"。

## 装完怎么确认

| 你看到什么 | 状态 | 怎么办 |
| --- | --- | --- |
| 侧边栏「工作区」标题右边多了一个铃铛 | 装上了 | — |
| 铃铛右上角红色数字 | 有跑完没看的会话 | `⌘⇧J`，或点铃铛 |
| 铃铛左上角黄色数字 | 有会话在等你处理 | `⌘⇧I`，或 `⌘⇧K` 看总览 |
| `⌘⇧K` 弹出「等你处理」两区网格 | 装上了 | 方向键选卡片，Enter 打开，Esc 关闭 |
| 看不到铃铛 | 侧边栏折叠成了 56px 轨道 | 展开侧边栏 |
| 铃铛在，但角标一直不清 | 浏览器到 host 的桥接失败 | 先刷新页面；仍不行看「已知限制」 |

## 怎么用

| 操作 | 结果 |
| --- | --- |
| 左键点铃铛 | 定位到下一个未读会话：滚动到可见并在对话栏打开；再点继续往后走，末尾绕回第一个 |
| 红色角标 | 已完成未查看的会话数（见「未读从哪来」） |
| 黄色角标 | 正在等你处理的会话数：审批、计划审阅、提问都算；与红色角标分开计数，不会互相顶掉 |
| 快捷键 J | 与左键点铃铛同一个跳转，默认 macOS `⌘⇧J`、Windows / Linux `Ctrl+Alt+J`，在 设置 → 通用 → 快捷键 改键 |
| 快捷键 I | 定位等待处理的会话：优先到最早开始等待的那个；处理完再按一次——还有别的 ask 就跳过去，没有了就原路返回上一个停留点 |
| 快捷键 K | 弹出「等你处理」总览：左列待决策（提问 / 审批 / 计划审阅），右区未读完成的会话，两边都是卡片网格；再按一次 K 关掉 |
| 总览里按 ↑ ↓ | 在当前区内上下移动选中卡片（到末尾绕回开头） |
| 总览里按 ← → | 在「待决策」与「未读」两区之间切换 |
| 总览里按 Enter | 打开选中的会话（未读的会同时标为已读），并关掉总览 |
| 总览里按 Esc / 点窗口外 / 点「关闭」 | 关掉总览，什么都不打开 |
| 右键点铃铛 | 打开/关闭「最近活动」列表（按天分组） |
| 点列表里的行 | 打开该会话并标为已读（与铃铛跳转同一路径） |
| 在某会话行右键 →「标为未读」 | 该会话计入铃铛角标与跳转顺序，直到被打开；标记由官方侧边栏持有，插件只读 |
| 在会话里滚到底部 | 该会话视为已读：角标与账本已读一并回落，再往上滚也不会重新变未读（被重启打断的会话同样由此确认） |
| Esc / 点侧边栏其它位置 | 关闭活动列表 |

## 快捷键

三条官方命令，都通过 `ctx.shortcuts` 注册，所以出现在 设置 → 通用 → 快捷键 里，可以改键，也和其它命令一起做冲突检测。

| 命令 | 作用 | macOS（Desktop / Web） | Windows / Linux | Web Linux |
| --- | --- | --- | --- | --- |
| `session-radar.jumpUnread` | 与铃铛左键同一个跳转（共享同一个游标） | `⌘⇧J`（`Mod+Shift+J`） | `Ctrl+Alt+J`（`Mod+Alt+J`） | 不绑默认 |
| `session-radar.jumpAsk` | 定位等待处理的会话，并沿原路返回 | `⌘⇧I`（`Mod+Shift+I`） | `Ctrl+Alt+I`（`Mod+Alt+I`） | 不绑默认 |
| `session-radar.overview` | 弹出「等你处理」总览（待决策 + 未读两区网格），再按一次关掉 | `⌘⇧K`（`Mod+Shift+K`） | `Ctrl+Shift+K`（`Mod+Shift+K`） | 不绑默认 |

J 与 I 两条命令的辅助键完全一致，只有字母不同：J 走未读，I 走等待处理。字母不能用 O——官方 `workspace.add`（桌面 `Mod+O`、Web `Mod+Alt+O`）与 `workspace.openLocal`（桌面 `Mod+Alt+O`、Web `Mod+Shift+O`）已经占满 O 的简单组合，而注册表在**任意** profile 上发现默认键重叠就会抛错，直接把整个客户端半边打挂。I 没有任何官方命令占用，也不是浏览器或系统快捷键。Web Linux 都只放行三个固定组合，所以三条都没有默认键。

K 也是同理：官方 `session.search`（搜索会话）占着桌面 `Mod+K` 与 Web `Mod+Alt+K`，所以总览**在所有平台都用 `Mod+Shift+K`**——这是三条命令里唯一不按 J / I 家族走的一条，Windows / Linux 上因此是 `Ctrl+Shift+K` 而不是 `Ctrl+Alt+K`。顺带记一笔：`P` 也被官方 `workspace.files` 占着（桌面 `Mod+P`、Web `Mod+Alt+P`），想换字母时别踩。

### I 的走法：先队列，再回栈

1. 只要还有会话在等你处理，按 I 就落到其中最早开始等待的那个，同时把「你原来在哪」记进回栈。
2. 处理完一个 ask（回答提问、批准、或处理计划审阅）后它就不再等待；再按 I——还有 ask 就跳到下一个，并把当前这个记进回栈。
3. 没有 ask 了，再按 I 就弹出回栈、回到上一个停留点；继续按就一路回到最开始的会话，走完为止。

例：`A`（当前）按 I 到 `B` → 处理完 `B` 按 I 到 `C` → 处理完 `C` 按 I 回到 `B` → 再按 I 回到 `A` → 再按没有反应（没有 ask，回栈也空了）。

macOS 只能用 `Mod+Shift+<字母>`，是两个约束卡在一起的结果：macOS Desktop 的 preload 会设 `data-dsh-desktop-web-shortcuts="true"`，runtime 因此是 `web`，所以（1）单 `⌘+字母` 被 Web 规则判 `unsupported-browser` 直接禁用——官方 `⌘K` 就因此无反应；（2）`⌘⌥U` 虽然注册合法，但 `Option+U` 是 macOS 死键，DOM 分发器把死键当输入法组合丢弃，框架只对 `⌘⌥N` 硬编码豁免。`Mod+Shift+J` 两个坑都躲开。R 系组合被官方 `session.rename`、`page.refresh` 占用；`⌘U` 则属于 Desktop 菜单的「检查更新」。要在 Web 改键，也在 设置 → 通用 → 快捷键 里录一个服务允许的组合；Web 默认值只保证注册合法，浏览器是否真的把按键送到页面仍需实测。

## 等你处理总览（K）

`⌘⇧K` 弹出的窗口把「还欠你的事」一次摆完：

- **左列「待决策」**：正在等你回答的会话——提问、审批、计划审阅，每张卡片标出是哪一种。列宽固定，优先级不随窗口宽度漂移。
- **右区「未读」**：跑完还没看的会话，卡片网格按可用宽度自动排布（每张最少 200px）。
- 一个会话**同时**「等你回答」又「跑完没看」时只出现在左列：回答它才是真正要做的事；未读标记会在你打开它时一并清掉。
- 点卡片与按 `Enter` 是同一个动作：打开该会话并关掉窗口，走的是和铃铛跳转完全相同的路径（含「打开即已读」与账本回写）。
- 窗口只列侧边栏自己会显示的会话：归档的、子代理子会话、空白的新建座位都不出现。
- 「对话栏当前打开的那个」会被高亮标出来，方便知道自己在哪。
- 窗口是纯前端投影：不额外拉取数据、不写任何会话状态，用的就是铃铛角标那套未读并集与实时待交互状态，所以角标数字和窗口里的卡片永远对得上。

## 未读从哪来（跨重启）

host 半边持有账本 `$DSH_HOME/session-radar.json`，原子写（临时文件 + rename）。

<details>
<summary>账本字段</summary>

| 字段 | 含义 |
| --- | --- |
| `lastTurnEndAt` / `lastTurnEndKind` | 最后一次 durable 轮次边界（completed / aborted / blocked / max-tokens…） |
| `lastAttentionAt` / `lastAttentionKind` | 最后一次待交互（approval / question） |
| `interruptedAt` | 被宿主退出切断的那一轮（`turn/end` 的 `aborted` + cause `disposed`） |
| `lastReadAt` | 操作者最后确认到的时间 |

</details>

- 未读 = `interruptedAt` 有值，**或** `max(turnEnd, attention) > lastReadAt`
- 记账来源：`session/event` 的 `turn/end` 与 `approval/asked`，加上 `ask_user_question` 的工具分发
- 已读 = 打开该会话（铃铛跳转或活动面板点行）｜在该会话发新消息｜把该会话的对话滚到底部
- 重启后自动恢复成当前会话的**不算已读**：客户端启动后有 3 秒静默窗

浏览器半边的角标与跳转顺序是**四路并集**，所以既有跨重启的账本项，也有本次会话里刚发生的事：

| 来源 | 覆盖 |
| --- | --- |
| 账本 `unread` | 跨刷新、跨重启都不丢的未读；host 端被读回后角标随之回落 |
| 官方 `completionUnread` | 在别处时跑完、框架标成未读的 |
| 浏览器观察到的「运行 → 停止」沿 | 就在眼前跑完、框架不标的 |
| Workspace 浏览器的手动「标为未读」 | 操作者右键会话行打的标记（见「已知限制」） |

打开会话即清掉前两路；手动标记由官方 `openSession` 一并清除。

**「在对话里滚到底部」本身就是已读**：官方对话区跟随最新内容时会给 chat 根节点打 `data-chat-following-tail`，插件据此把当前会话踢出前两路，并立刻回写 host 账本的 `read`。所以你在自己看着的对话里新跑完一轮不会变成未读；只有你翻到上面、内容从下方长出来时才提醒。手动标记是显式动作，仍会保留。

## 被重启打断的会话

`interruptedAt` 是一个**只标记、不修**的账本事实：不打红点、不发消息，唯一可见后果是——在你**把它的对话读到尾部**之前，它即使被打开过也算未读；读到尾部（或打开时本来就停在尾部）就**永久已读**，再往上滚也不会回来。

- 判定：最后一次 `turn/end` 是**重启**造成的，不是操作者造成的。两条信号都算：
  - 优雅退出：宿主动态 dispose 会在 `session/event` 上发 `aborted` + cause `disposed`
  - 崩溃修复：DSH 给没结束的尾回合补一条 reason `interrupted` 的 `turn/end`。它作为构造 seed 注入，**永远不发 `session/event`**，所以 host 在 `session/created`（外加启动时扫一次 live agents）读 `session.snapshotEvents()` 找它
  - 其后出现 `turn/start` 或 `user/message` 视为已被取代，不再算被打断
- 插件**只标记、不发消息**：重启后要不要继续、什么时候继续，由你自己决定

## 会话状态读数（六项计数）

侧边栏底部还有一行常驻读数，把六种会话状态一起摆出来：

| 计数 | 含义 | 数据来源 |
| --- | --- | --- |
| 运行中 | 会话的 Agent 正在跑 | 官方会话 UI 状态的 `running` |
| 未读 | 在你没看的时候停下来、还没确认 | 官方会话 UI 状态的 `completionUnread` |
| 待处理 | 有审批 / 计划审阅 / 提问在等你回答 | 官方会话 UI 状态的 `pendingInteraction` |
| 闲置 | 上面三种都不是的未归档会话 | 由前几项派生 |
| 未归档 | 普通会话里不在归档集里的数量 | 官方会话列表 + Workspace 归档集 |
| 已归档 | 普通会话里在归档集里的数量 | 同上 |

- **范围**：只数「普通会话」——排除子代理子会话，也排除空白的新建会话座位。
- **归档轴**：普通会话要么算「未归档」，要么算「已归档」，互斥。
- **活动轴**：未归档的普通会话按 `待处理 > 运行中 > 未读 > 闲置` 的优先级恰好落进一类，四项之和恒等于未归档数，不会把一个「一边跑一边等你审批」的会话数两遍。
- 两种版式：**胶囊**（默认，每项一个「图标 + 数字」）与**比例条**（运行 / 未读 / 待处理 / 闲置的堆叠条 + 完整数字）；侧边栏收成 56px 时折叠为单图标 + 未归档角标，悬停或键盘聚焦弹出完整读数。
- 口径只有一份实现：`src/count.ts`；读数与设置行共用，数值不会两边打架。

设置页 设置 → 通用 → **会话状态读数**：逐项开关、版式二选一、未归档告警阈值（默认 10，严格大于才告警）。偏好挂在本插件自己的 Config 命名空间（row id `session-radar`）下，改动经 Host settings 落进 profile patch。Host 没有服务该命名空间时，设置行不注册，读数仍按默认偏好显示。

读数只读 shell 已发布的三个标准快照（`useSessions` / `useSessionStatus` / `useWorkspaces`），不写任何会话或归档状态、不落盘、不联网。

## 已知限制

- 依赖官方 DOM 契约 `[data-row-key="session:<id>"]` / `[class*="listArea"]` / `[class*="sectionHeader"]`，官方改版可能失效。
- 「滚到底部=已读」依赖官方对话区契约 `[data-conversation-region="chat"][data-conversation-session]` 与 `[data-chat-following-tail]`；属性不存在时这一路静默失效，退回「切走再切回才算已读」的旧行为。
- 工作区分组**折叠**时那一行不在 DOM 里：插件先点开分组再滚动；展开后仍找不到（归档、被筛选隐藏、不在当前列表）则**只打开、不滚动**。
- 侧边栏折叠成 56px 轨道时不显示铃铛（该位置被官方占用）。
- 崩溃（进程被强杀）走修复补写的 `interrupted`；会话不暴露 `snapshotEvents()` 也不暴露 `events` 时这一路静默失效。
- 标记只在你让该会话再跑一轮（自己发消息，或别的插件补发）之后由 `turn/end` 清掉；本插件从不发送消息。
- 浏览器到 host 的桥接失败会发布在账本快照的 `error` 上并保留上一次已知数据（不清空）；目前没有界面渲染它。
- 手动「标为未读」不在任何公开快照里：插件直接读 Workspace 浏览器持久化的私有键 `dsh.workspace.view.v5`。官方改键名时这一路会静默失效，其它未读来源不受影响。
- 快捷键默认值同时受官方服务、macOS 死键与 Desktop 菜单限制：macOS Desktop 以 `web` runtime 分发，单 `⌘+字母` 被判 `unsupported-browser`（官方 `⌘K` 也失效），`⌘⌥<死键>`（如 `U`）被当输入法组合丢弃，`⌘U` 又归 Desktop 菜单「检查更新」，R 系撞官方 `session.rename` / `page.refresh`，`Mod+K` 与 Web 上的 `Mod+Alt+K` 撞官方 `session.search`，`Mod+P` 与 Web 上的 `Mod+Alt+P` 撞官方 `workspace.files`；所以 J / I 的 macOS 默认用 `⌘⇧<字母>`、Windows/Linux 用 `Ctrl+Alt+<字母>`，K 则全域用 `Mod+Shift+K`（Windows/Linux 即 `Ctrl+Shift+K`）；Linux Web 只放行三个固定组合，三条都没有默认键。
- 「等待处理」角标与 I 跳转覆盖审批、计划审阅、提问三类，数据来自实时状态；跳转顺序取活动列表「最新更新在前」的逆序，所以通常是**最早开始等待**的排最前。打开会话不会清掉等待处理，只有真正回答/批准/处理计划审阅才会清。
- I 的回栈只活在当前页面的内存里：刷新页面后回栈清空（等待处理角标与队列会由实时状态重建）。
- 「等你处理」总览（K）与角标共用同一份投影，窗口本身不缓存任何东西；窗口打开期间若某个会话被别处处理掉，卡片会立即跟着消失。K 在 Linux Web 同样没有默认键（该平台只放行三个固定组合），需要在 设置 → 通用 → 快捷键 里自己录一个。

## 安全边界

这个插件写出去的东西只有两处，其余全是只读：

- **只写自己的账本**：`$DSH_HOME/session-radar.json`（临时文件 + rename 的原子写），加上你在设置页改的那几个偏好。
- **不碰会话数据**：不归档、不删除、不改写会话内容或工作区注册；状态读数只读官方已发布的三份快照。
- **从不替你发消息**：被重启打断的会话只做标记，继不继续、什么时候继续由你决定 —— 代码里没有任何发送消息的路径。
- **不联网**：除 host 半边的本地路由（浏览器半边读账本）外，不发起任何外部请求。
- **只读 DOM 做定位，不读内容**：靠官方 DOM 契约找会话行与对话区（见「已知限制」），不解析、不上传会话正文。

## 兼容性

- DSH `0.1.x`（含 `0.1.7-rc`）与 `0.2.0-rc.1` 起的 `0.2.x`（`peerDependencies` 里逐包声明，`0.2.1-alpha` 也在范围内）。
- 升级 DSH 后若安装被拒（报 peer 范围不含当前 dsh 版本），先按 `peerDependencies` 补上新的版本段，再跑 `node scripts/capture-official-contract.mjs` 核对官方契约是否仍成立、`npm run verify` 是否通过；`test/official-contract.test.mjs` 会把「装了但没声明」直接判失败，避免又出现「README 说支持、peer 范围没跟上」。
- 浏览器半边固定 `platform: web`；Desktop 也以 `web` runtime 分发，所以两端行为一致。
- 依赖官方客户端半边：`ui-sidebar`、`ui-workspace`、`ui-session`、`ui-slots`、`ui-renderer`、`ui-primitives`、`ui-settings`、`ui-settings-general`、`client-locale`、`client-shortcuts`（都是 `dsh-base` + `dsh-web-app` 自带的）。

### 从 `dsh-unread-helper` 升级（1.0 改名）

1.0 把包名与内部标识统一改成 `session-radar`：包名 `dsh-session-radar`、row id 与设置命名空间 `session-radar`、路由 `/session-radar`、账本 `$DSH_HOME/session-radar.json`、快捷键命令 id `session-radar.jumpUnread` / `session-radar.jumpAsk`。

- 账本**不会丢**：启动时读不到 `session-radar.json`，host 会一次性抄自同目录的 `unread-helper.json`（旧文件保留原地，不删除），抄完立即写入新文件。
- 旧安装要换依赖名：`dsh plugin --profile web remove dsh-unread-helper` 再 `dsh plugin --profile web add dsh-session-radar`。
- 你在「设置 → 通用 → 快捷键」里给旧命令 id 改过的键位需要重设，因为命令 id 随包名一起改了。

## 文件结构

| 路径 | 作用 |
| --- | --- |
| `src/index.ts` / `src/host.ts` | host 半边：账本、持久化、`/session-radar/*` 路由、Config schema |
| `src/ledger.ts` / `src/activity-model.ts` | 纯状态机：未读判定、重启打断、活动投影（无框架依赖） |
| `src/count.ts` | 六项计数的唯一口径，读数与设置行共用 |
| `src/overview.ts` / `src/client/overview-cursor.ts` | 「等你处理」总览的纯投影（待决策 / 未读两区）与方向键游标（无框架依赖） |
| `src/client/` | 浏览器半边：铃铛、跳转与快捷键、状态读数、设置行、样式与文案 |
| `cordis.patch.yml` | bundle 层：往 profile 里插入 `session-radar` 这一行 |
| `lib/` | 被跟踪的构建产物（Git 安装免 build） |
| `test/` | `node --test` + jsdom，`npm run verify` 一次跑完 |
| `test/official-contract.test.mjs` | 官方契约快照：peer 范围是否覆盖已装版本、读数与设置行依赖的字段与槽位、DOM 锚点与视图 store 键 |
| `scripts/capture-bell.mjs` | 可复现的截图脚本（headless Chrome，只截不含内容的侧栏行） |
| `scripts/capture-official-contract.mjs` | 重采官方契约片段，供 `test/official-contract.test.mjs` 的夹具比对 |

## 开发

```sh
npm ci
npm run verify    # typecheck + build + 171 个测试
```

`test/ledger.test.mjs` 覆盖账本状态机（未读、已读不回退、两种重启信号、存储器尾部扫描）；`test/host.test.mjs` 用假 ctx 挂载 host 半边，断言恢复扫描、live 清除与畸形输入；`test/jump.test.mjs` 覆盖未读选择与分组展开；`test/jump-command.test.mjs` 覆盖快捷键命令的座位、默认键位与 blocked/handled 解析；`test/manual-unread.test.mjs` 覆盖官方手动未读标记的解析与监听；`test/conversation-tail.test.mjs` 覆盖「对话在底部」的锚点；`test/ask-jump.test.mjs` 覆盖等待处理跳转的「队列 + 回栈」状态机；`test/activity-model.test.mjs` 覆盖活动投影与 pending 计数；`test/client-mount.test.mjs` 用真实客户端半边挂载，断言铃铛与状态读数分别是侧边栏 footer 的入口、黄色角标只数等待处理的会话、I 的整条往返路径、以及 K 总览的渲染 / 键盘 / 关闭三条路径；`test/overview.test.mjs` 覆盖总览的两区分割与去重口径；`test/overview-cursor.test.mjs` 覆盖方向键游标的环绕、切区与越界收敛；`test/count.test.mjs` 覆盖六项口径、分区不变量与阈值边界；`test/client-render.test.mjs` 用 SSR 真渲染读数与设置行；`test/client-contract.test.mjs` 覆盖模块 id、inject 清单、三处注册与「Host 没服务命名空间就不注册设置行」；`test/official-contract.test.mjs` 把官方契约钉成快照——已装官方包版本必须落在 `peerDependencies` 声明范围内，读数与设置行读的字段、两个槽位、DOM 锚点与 `dsh.workspace.view.v5` 一旦从官方产物里消失即判失败（用 `node scripts/capture-official-contract.mjs` 重采复核）。

`lib/` 是被跟踪的构建产物（Git 安装免 build）：改 `src/` 后必须 `npm run build` 并一起提交，CI 会断言提交进库的 `lib/` 与构建产物一致。

## 致谢

最初源自 [minivv/dsh-activity-bell](https://github.com/minivv/dsh-activity-bell)（MIT，作者 Wei）。上游把「点铃铛」做成换一份活动列表；本项目改成**顺序定位未读**，并补上 host 账本与「等待你处理」队列。此后独立演进，不再跟踪上游；上游版权与许可原文按 MIT 要求保留在 `LICENSE`。侧边栏底部的会话状态读数与其设置行合并自同一作者的 [dsh-session-watch](https://github.com/d0ublecl1ck/dsh-session-watch)（MIT）。

## License

MIT。`LICENSE` 保留上游版权行，并追加本项目版权行。

## English

**dsh-session-radar** adds an unread/attention bell to the DeepSeek Harness sidebar.

- `⌘⇧J` (macOS) / `Ctrl+Alt+J` (Windows/Linux) walks unread sessions in order.
- `⌘⇧I` / `Ctrl+Alt+I` walks sessions waiting for you (questions, approvals, plan reviews) and then retraces your path back.
- `⌘⇧K` / `Ctrl+Shift+K` opens a waiting overview: pending asks in a fixed left column, unread completions in a grid beside them; arrows move, Enter opens the selected session, Esc (or the same shortcut again) closes it.
- A host-side ledger at `$DSH_HOME/session-radar.json` keeps the unread/attention state across restarts.
- A sidebar-foot readout shows six Session counts (running / unread / pending / idle / unarchived / archived) in two layouts; Settings → General → Session status readout toggles each metric and sets the unarchived warning threshold.

It writes exactly two things: its own ledger (`$DSH_HOME/session-radar.json`) and your own preferences in Settings. It never archives, deletes, rewrites or sends anything on your Sessions, and never talks to the network.

Install: `dsh plugin --profile web add dsh-session-radar` (or `github:d0ublecl1ck/dsh-session-radar`), then refresh the page. Originally derived from [minivv/dsh-activity-bell](https://github.com/minivv/dsh-activity-bell) (MIT; the upstream notice is retained in `LICENSE`); the status readout is merged from [dsh-session-watch](https://github.com/d0ublecl1ck/dsh-session-watch) (MIT).
