# dsh-session-ledger

DSH Web 插件：侧边栏**未读铃铛**（左键顺序定位未读、右键最近活动）+ 一个只显示「被重启打断」的 chip；host 半边持有一份**跨重启的会话账本**。

fork 自 `minivv/dsh-activity-bell`（MIT）。上游主交互是「换掉整个侧边栏列表」；本 fork 把它改成「定位」，再在 host 侧补上账本。

## 怎么跑

- 开发：`npm ci`，`npm run verify`（typecheck + build + node 测试）。
- 装进实例：`dsh plugin --profile web add <本目录绝对路径>`，然后刷新页面。
- `lib/` 是**被跟踪的构建产物**：改 `src/` 后必须 `npm run build` 并一起提交，否则安装方拿到旧 bundle。
- **改了 host 半边必须 `remove` + `add`**：宿主按 URL 缓存模块，只 `add` 不会重新导入；症状是"改了没生效"。

## 技术栈

- TypeScript（三个 tsconfig）+ esbuild；客户端产物是浏览器模块（`window.__ModuleLoader__.load`，无 JSX 运行时）。
- 测试：`node --test` + jsdom，用真实客户端半边挂载组件。
- host 半边不是空的：账本、持久化、路由都在 `src/host.ts`。

## 目录约定

- `src/ledger.ts` —— 纯账本状态机（无框架依赖，单测直接打它）。
- `src/host.ts` —— host 行为：`session/event` 记账、重启孤儿扫描（`session/created` + 启动时扫一遍 live agents 的 `snapshotEvents()`）、`$DSH_HOME/session-ledger.json` 原子写、`POST /session-ledger/*` 路由（`connection.requestRejection` 鉴权）。`src/index.ts` 只做导出接线。
- `src/client/ledger-source.ts` —— 浏览器到账本的唯一桥（同源 `fetch`），把桥接失败**发布**出去而不是吞掉。
- `src/client/ActivityBell.tsx` 铃铛与活动面板；`LedgerChip.tsx` 只显示被打断项与未读项；`jump.ts` 未读选择与行定位；`jump-command.ts` 快捷键命令与铃铛座位（官方 `ctx.shortcuts`）；`completions.ts` 本地边沿记账；`manual-unread.ts` 读官方侧边栏的「标为未读」并监听其写入；`conversation-tail.ts` + `use-conversation-tail.ts` 判断对话是否停在底部；`anchors.ts` 官方 DOM 锚点；`locales.ts` 文案。
- `test/` 与 `src/` 同名对应；`scripts/build.mjs`、`scripts/build-tests.mjs` 是构建入口。
- 依赖官方 DOM 契约：`[data-row-key="session:<id>"]`、`[class*="listArea"]`、`[class*="sectionHeader"]`、`[data-conversation-region="chat"][data-conversation-session]`、`[data-chat-following-tail]`。
- 依赖官方持久化键：Workspace 浏览器的手动未读存在 `localStorage` 的 `dsh.workspace.view.v5` 里，官方改键名会静默失效。

## 当前状态与下一步

- 已实现：账本持久化（未读跨刷新/重启）、铃铛角标与跳转读「账本 ∪ 官方 completionUnread ∪ 本地完成边沿 ∪ 官方手动未读」、对话停在底部即视为已读（并立刻回写账本 read）、被打断会话的 chip（只标记，不发送消息）、打开会话回写已读、启动静默窗避免"自动恢复=已读"、未读跳转的官方快捷键命令（macOS `⌘⇧J`；Windows/Linux `Ctrl+Alt+J`，可在 设置→通用→快捷键 改键）。
- 被打断的判据是 `turn/end` 的两种重启信号：优雅退出的 `aborted` + cause `disposed`（走 `session/event`），以及崩溃修复补写的 `interrupted`（只存在于存储器快照里，host 靠 `session/created` 与启动扫描读取，因为构造 seed 不发 `session/event`）。
- 下一步（未做）：chip 的「只看未读」筛选、跨工作区排序、把被打断项并进铃铛右键面板以去掉第二个入口。
