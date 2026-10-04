# dsh-session-radar

DSH Web 插件，合并了三半能力：侧边栏**未读铃铛**（左键顺序定位未读、右键最近活动；另有黄色警告角标与 I 快捷键，专走「等待你处理」的会话；K 快捷键弹出「等你处理」总览，把未读与待决策的会话铺成两区卡片网格）、侧边栏底部的**会话状态读数**（运行中 / 未读 / 待处理 / 闲置 / 未归档 / 已归档六项计数；两种版式；设置页可逐项开关、切换版式、设未归档告警阈值），以及 host 半边的**跨重启的会话账本**（账本里的 `interruptedAt` 只用来让被重启打断的会话保持未读）与本插件的偏好 **Config**。

最初源自 `minivv/dsh-activity-bell`（MIT，版权与许可原文保留在 `LICENSE`）。上游主交互是「换掉整个侧边栏列表」；本项目把它改成「定位」，再在 host 侧补上账本。状态读数与其设置行合并自同一作者的 `dsh-session-watch`（MIT）。已与上游脱钩：本地不再保留 upstream remote，也不再合并上游改动。

## 怎么跑

- 开发：`npm ci`，`npm run verify`（typecheck + build + node 测试）。
- CI：`.github/workflows/verify.yml` 在 push/PR 上跑 `npm run verify`，并断言提交进库的 `lib/` 与构建产物一致（两处都要通过）。
- 装进实例：`dsh plugin --profile web add <本目录绝对路径>`，然后刷新页面。
- `lib/` 是**被跟踪的构建产物**：改 `src/` 后必须 `npm run build` 并一起提交，否则安装方拿到旧 bundle。
- **改了 host 半边必须 `remove` + `add`**：宿主按 URL 缓存模块，只 `add` 不会重新导入；症状是"改了没生效"。**IF** 改包名或目录后宿主行第一次激活失败 -> **MUST** 重启 DSH Desktop；运行中的实例会把那次模块解析失败缓存住，之后即使文件系统已正确，`setBundleEnabled` 重挂也一直报 `Cannot find package …index.js`。
- **只改了客户端半边**：宿主按 `/plugins/…&rev=<hash>` 分发 bundle，响应头是 `cache-control: public, max-age=31536000, immutable`，所以普通刷新可能命中旧缓存 —— 验证新代码 **MUST** 用硬刷新（`⌘⇧R` / `Ctrl+Shift+R`），否则会把「缓存里还是旧 bundle」误判成「功能没生效」。

## 技术栈

- TypeScript（三个 tsconfig）+ esbuild；客户端产物是浏览器模块（`window.__ModuleLoader__.load`，无 JSX 运行时），**一个 bundle、一个客户端入口**。
- host 半边依赖 `@deepseek-ai/schemastery` 声明本插件 Config：row id `session-radar`，八个 **volatile** 字段（`threshold` / `variant` / 六个 `show*`）；dsh-settings 只投影 volatile 字段，缺一个设置行就读不到。
- 读数只读官方标准 hook 的三份快照（`useSessions` / `useSessionStatus` / `useWorkspaces`），不依赖任何第三方插件；官方包形状用 `src/client/watch-types.ts` 的结构化类型描述。
- 测试：`node --test` + jsdom，用真实客户端半边挂载组件；纯计数测试直接打 `.test-build/count.js` 与 `.test-build/config.js`。
- host 半边不是空的：账本、持久化、路由都在 `src/host.ts`。

## 测试与验证

- 一把跑完：`npm ci && npm run verify`（typecheck + build + node 测试，当前 172 个）。
- 测试清单：`test/ledger.test.mjs` 覆盖账本状态机（未读、已读不回退、两种重启信号、存储器尾部扫描）；`test/host.test.mjs` 用假 ctx 挂载 host 半边，断言恢复扫描、live 清除与畸形输入；`test/jump.test.mjs` 覆盖未读选择与分组展开；`test/jump-command.test.mjs` 覆盖三条快捷键命令的座位、默认键位、合法性、官方 KeyK / KeyO 不重叠与 blocked/handled 解析；`test/manual-unread.test.mjs` 覆盖官方手动未读标记的解析与监听；`test/conversation-tail.test.mjs` 覆盖「对话在底部」的锚点；`test/ask-jump.test.mjs` 覆盖等待处理跳转的「队列 + 回栈」状态机；`test/activity-model.test.mjs` 覆盖活动投影与 pending 计数；`test/overview.test.mjs` 覆盖总览两区的分割与去重；`test/overview-cursor.test.mjs` 覆盖方向键游标的环绕、切区与越界收敛；`test/count.test.mjs` 覆盖六项口径、分区不变量与阈值边界；`test/client-mount.test.mjs` 用真实客户端半边挂载，断言铃铛与读数入口、黄色角标只数等待处理、I 的整条往返路径、K 总览的渲染 / 键盘 / 空态 / 关闭；`test/client-render.test.mjs` 用 SSR 真渲染读数与设置行；`test/client-contract.test.mjs` 覆盖模块 id、inject 清单与三处注册。
- `test/official-contract.test.mjs` 把官方契约钉成快照（已装官方包版本必须落在 `peerDependencies` 内、读数与设置行依赖的字段与槽位、DOM 锚点与 `dsh.workspace.view.v5`），重采用 `node scripts/capture-official-contract.mjs`。
- 构建与分发：`cordis.patch.yml` 是 bundle 层（往 profile 插入 `session-radar` 一行）；`lib/` 是被跟踪的构建产物（Git 安装免 build），改 `src/` 后必须 `npm run build` 并一起提交，CI 会断言提交进库的 `lib/` 与构建产物一致。
- 截图：`scripts/capture-bell.mjs` 从运行实例生成 README 用的侧栏标题行截图（headless Chrome，只截不含会话名 / 项目名的行）。
- 展示类截图 **MUST** 走受控路径：在**示例工作区**（如 `/tmp/<name>-shot-workspace`）里用 `workspace/create` + `session/create` + `session/prompt` 造示例会话，用无头 Chromium 只截目标 UI（不截侧栏其它工作区名、账号、余额），截完立刻 `session/delete` + `workspace/delete` 复原，并在汇报里给出 `session/list` 的复查证据；**MUST NOT** 直接截操作者正在看的真实界面。`assets/overview.png`（⌘⇧K 总览）就是这样产生的。
- 造状态时的两个已知坑：`ask_user_question` 在**没有客户端订阅该会话**时会被立即结算（提问不落地），要么先让 UI 打开该会话再投递，要么改用「手动未读」这类合法来源把另一区补出来；`session/delete` 之前先 `session/cancel`，否则正在跑的回合会被 `dsh-client-auto-continue` 一类插件派生出一条指向同一 `cwd` 的续跑会话，须一并清理并复查 `cwd`。

## 文档约定

- **README 只写使用者视角**：安装、生效、自检、用法、快捷键、限制、安全边界这一类；文件结构、构建命令、测试清单、包管理细节属于维护者内容，**MUST** 放在本文件（或 `CHANGELOG.md` / 脚本头部注释），不要塞回 README。
- 面向用户的文案改动按「键名：旧 -> 新」对照汇报；版本叙事写进 `CHANGELOG.md`，标签与 npm 版本一一对应。

## 目录约定

- `src/ledger.ts` —— 纯账本状态机（无框架依赖，单测直接打它）。
- `src/host.ts` —— host 行为：`session/event` 记账、重启孤儿扫描（`session/created` + 启动时扫一遍 live agents 的 `snapshotEvents()`）、`$DSH_HOME/session-radar.json` 原子写、`POST /session-radar/*` 路由（`connection.requestRejection` 鉴权）。`src/index.ts` 只做导出接线。
- `src/count.ts` —— 纯计数口径：`countSessions` 六项、`countUnarchived`、`normalizeThreshold`、`shouldWarn`；无框架依赖，读数与设置行共用。
- `src/config.ts` —— 指标清单（`METRICS`）、Config 字段名（`METRIC_FIELD`）、默认可见性、版式清单（`VARIANTS`）、`PLUGIN_ID`（= row id = settings 命名空间 = locale NS = `session-radar`）。
- `src/overview.ts` —— 「等你处理」总览的纯投影：折叠活动列表自己的行，再切成「待决策」与「未读」两区（无框架依赖，单测直接打它）。
- `src/client/ledger-source.ts` —— 浏览器到账本的唯一桥（同源 `fetch`），把桥接失败**发布**出去而不是吞掉。
- `src/client/ActivityBell.tsx` 铃铛、活动面板与 K 总览弹窗（弹窗 portal 到 `document.body`，全页浮层，不依赖 `wide`）；`jump.ts` 未读选择、当前会话与行定位；`ask-jump.ts` 等待处理跳转的「队列 + 回栈」纯状态机；`overview-cursor.ts` 总览的两区键盘游标（纯状态机）；`jump-command.ts` 三条快捷键命令（未读 J / 等待处理 I / 总览 K）与各自独立的铃铛座位（官方 `ctx.shortcuts`）；`completions.ts` 本地边沿记账；`manual-unread.ts` 读官方侧边栏的「标为未读」并监听其写入；`conversation-tail.ts` + `use-conversation-tail.ts` 判断对话是否停在底部；`anchors.ts` 官方 DOM 锚点；`locales.ts` 文案。
- `src/client/StatusWatch.tsx` 侧边栏底部读数（胶囊 / 比例条 / rail 三态）；`SettingsRow.tsx` 设置页偏好行；`config-source.ts` 把 config form 投影成可订阅偏好；`use-counts.ts` 从三个标准 hook 读出六项；`summary.ts` 指标名与一行摘要；`watch-types.ts` 官方 configForms / slots 的结构化类型。
- `src/client/styles.ts` 是**唯一**样式表：`ab-*`（铃铛/面板）、`ov-*`（K 总览浮层）与 `sw-*`（读数/设置行）同在一个 `<style data-plugin="dsh-session-radar">` 里。
- `test/` 与 `src/` 同名对应；`test/watch-harness.mjs` 是读数测试的假 client context 与快照夹具；`scripts/build.mjs`、`scripts/build-tests.mjs` 是构建入口。
- `assets/` —— README 用的真实截图；由 `scripts/capture-bell.mjs` 从运行中的实例裁剪生成（只裁侧栏标题行，不含会话名/项目名/账号；不要用活动面板或列表区截图）。
- 依赖官方 DOM 契约：`[data-row-key="session:<id>"]`、`[class*="listArea"]`、`[class*="sectionHeader"]`、`[data-conversation-region="chat"][data-conversation-session]`、`[data-chat-following-tail]`。
- 依赖官方持久化键：Workspace 浏览器的手动未读存在 `localStorage` 的 `dsh.workspace.view.v5` 里，官方改键名会静默失效。

## 合并后的脆弱契约

- **一个 bundle、一个客户端入口**：`lib/client.js` 的模块 id 必须等于包名 `dsh-session-radar`；读数只能作为同一 client 模块里的另一组 `ctx.effect` 注册，不得再挂第二个 `dsh.client` 入口。
- **config 命名空间 = row id = `session-radar`**：设置行的 entry id 与 Config 命名空间都用它。铃铛在 `sidebar.footer.action` 的 entry id 仍是 `session-radar`，读数用 `session-radar.status`（同一个 list slot 不允许重复 entry id）；改名会让 Host 不再服务命名空间、设置行静默消失，但读数仍按默认偏好显示。
- **`inject` 新增必需服务 `configForms`**，且 `dsh.client.inject` 新列了 `@deepseek-ai/dsh-client-ui-settings` 与 `@deepseek-ai/dsh-client-ui-settings-general`：Shell 若不再声明 `settings.general.item`，设置行不注册（读数不受影响）；若 `configForms` 服务本身缺失，整个客户端半边（含铃铛）不会挂载。
- **六项口径只有一份实现**（`src/count.ts`）：读数与设置行共用；筛选依赖 `SessionListState.ids/byId`、`WorkspaceSnapshot.archivedSessionIds` 与 `SessionStatus.running/completionUnread/pendingInteraction`，官方改字段名会静默把数字变成 0 或偏大。
- **活动四项是分区**：`待处理 > 运行中 > 未读 > 闲置`，四者之和恒等于未归档；阈值告警严格大于（第 11 个才告警）。
- **读数/设置行不写任何会话或归档状态**：唯一写入是用户在设置里改的偏好字段。
- **快捷键默认位受官方注册表约束**：注册表对**任意**声明 profile 的默认键做重叠检查，撞上官方命令就抛 `Conflicting shortcut defaults`，把整个客户端半边打成 failed。已知占满简单组合的官方命令：`session.search` = 桌面 `Mod+K` / Web `Mod+Alt+K`，`workspace.add` = 桌面 `Mod+O` / Web `Mod+Alt+O`，`workspace.openLocal` = 桌面 `Mod+Alt+O` / Web `Mod+Shift+O`，`workspace.files` = 桌面 `Mod+P` / Web `Mod+Alt+P`。所以 J / I 用 `Mod+Shift`（macOS）与 `Mod+Alt`（Windows/Linux），总览 K 在**所有**平台都用 `Mod+Shift+K`（`Mod+Alt+K` 在 Web 上属于 `session.search`）。新增或改动任何默认键前 **MUST** 先核对官方注册表并在真实实例里做一次激活验证。

## 当前状态与下一步

- 已实现：账本持久化（未读跨刷新/重启）、铃铛角标与跳转读「账本 ∪ 官方 completionUnread ∪ 本地完成边沿 ∪ 官方手动未读」（侧边栏只有铃铛一个入口）、对话停在底部即视为已读（并立刻回写账本 read）、打开会话回写已读、启动静默窗避免"自动恢复=已读"、被重启打断的会话以「读到对话尾部」为确认（单纯打开不算）、未读跳转的官方快捷键命令（macOS `⌘⇧J`；Windows/Linux `Ctrl+Alt+J`，可在 设置→通用→快捷键 改键）、待处理提醒（审批/计划审阅/提问在铃铛左上角单独用黄色警告角标计数；I 快捷键先走等待队列、每处理完一个就跳下一个，没有等待项时沿回栈原路返回，辅助键与 J 一致：macOS `⌘⇧I`；Windows/Linux `Ctrl+Alt+I`。字母不能选 O：官方 `workspace.add` / `workspace.openLocal` 已占满 O 的简单组合，注册默认键重叠会挂掉整个客户端半边）。
- 已实现（本次合并）：会话状态读数（六项计数、胶囊 / 比例条、rail 折叠为单图标 + 未归档角标）、设置页逐项开关 + 版式 + 阈值，偏好挂在 row id `session-radar` 的 Config 下（八个 volatile 字段）；读数与铃铛在同一 `sidebar.footer.action` 区域（读数 order 890，铃铛 900），仍是一个客户端入口。版本号保持 0.2.0。
- 偏好迁移：`dsh-session-watch` 的旧偏好（row id `session-watch`）**不自动迁移**；两个插件是不同 row，卸载旧插件后在本插件的设置行重设即可（默认值与 0.4.0 相同）。
- 已实现（本次）：**「等你处理」总览**——官方快捷键命令 `session-radar.overview`（全域 `Mod+Shift+K`，Linux Web 无默认键），弹出全页浮层：左列「待决策」按最新更新在前，右区「未读」自适应网格，两区去重（同时待决策又未读的只在左列），↑↓ 区内环绕、←→ 切区、Enter 打开并关窗、Esc / 点遮罩 / 点关闭 / 再按一次 K 关窗；**没有任何等待时命令也可用**，窗口显示一句空态提示（原先 blocked 会让按键毫无反应）。投影是 `src/overview.ts`（折叠 `buildActivityGroups` 的行，口径与角标一致），游标是 `src/client/overview-cursor.ts`。弹窗 portal 到 `document.body`，因此不受侧边栏宽度限制。
- 被打断的判据是 `turn/end` 的两种重启信号：优雅退出的 `aborted` + cause `disposed`（走 `session/event`），以及崩溃修复补写的 `interrupted`（只存在于存储器快照里，host 靠 `session/created` 与启动扫描读取，因为构造 seed 不发 `session/event`）。
- 下一步（未做）：把桥接失败（账本快照 `error`）重新露出到铃铛、跨工作区排序。
