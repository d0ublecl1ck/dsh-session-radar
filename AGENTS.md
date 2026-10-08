# dsh-session-radar

DSH Web 插件，合并了三半能力：侧边栏**未读铃铛**（左键顺序定位未读、右键最近活动；另有黄色警告角标与 I 快捷键，专走「等待你处理」的会话；K 快捷键弹出「等你处理」总览，把未读与待决策的会话铺成两区卡片网格）、侧边栏底部的**会话状态读数**（运行中 / 未读 / 待处理 / 闲置 / 未归档 / 已归档六项计数；两种版式；每项图标可点，点了跳到下一个同类会话，「已归档」除外；设置页可逐项开关、切换版式、设未归档告警阈值），以及 host 半边的**跨重启的会话账本**（账本记住「上一个进程退出时还有哪些回合开着」，下次启动把它们当作被重启打断、保持未读）与本插件的偏好 **Config**。

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
- host 半边依赖 `@deepseek-ai/schemastery` 声明本插件 Config：row id `session-radar`，九个 **volatile** 字段（`threshold` / `variant` / 六个 `show*` / `showRowBadge`）；dsh-settings 只投影 volatile 字段，缺一个设置行就读不到。
- 读数只读官方标准 hook 的三份快照（`useSessions` / `useSessionStatus` / `useWorkspaces`），不依赖任何第三方插件；官方包形状用 `src/client/watch-types.ts` 的结构化类型描述。
- 测试：`node --test` + jsdom，用真实客户端半边挂载组件；纯计数测试直接打 `.test-build/count.js` 与 `.test-build/config.js`。
- host 半边不是空的：账本、持久化、路由都在 `src/host.ts`。

## 测试与验证

- 一把跑完：`npm ci && npm run verify`（typecheck + build + node 测试，当前 222 个）。
- 测试清单：`test/ledger.test.mjs` 覆盖账本状态机（未读、已读不回退、三种重启信号、开合回合的标记、启动时采纳遗留回合、存储器尾部扫描）；`test/host.test.mjs` 用假 ctx 挂载 host 半边，断言恢复扫描、live 清除与畸形输入；`test/retry-model.test.mjs` 覆盖续跑清单的纯逻辑（筛出被打断的会话、未完成的子代理回落到顶层父会话、`parentId` 上溯与多子去重、默认全选、正在跑的不给勾、串行发送与「只确认被接受的那条」）；`test/jump.test.mjs` 覆盖未读选择与分组展开；`test/jump-command.test.mjs` 覆盖三条快捷键命令的座位、默认键位、合法性、官方 KeyK / KeyO 不重叠与 blocked/handled 解析；`test/manual-unread.test.mjs` 覆盖官方手动未读标记的解析与监听；`test/conversation-tail.test.mjs` 覆盖「对话在底部」的锚点与它向账本报的那一次读取（自动恢复的会话不确认中断，自己打开的才确认）；`test/ask-jump.test.mjs` 覆盖等待处理跳转的「队列 + 回栈」状态机；`test/activity-model.test.mjs` 覆盖活动投影与 pending 计数；`test/overview.test.mjs` 覆盖总览两区的分割与去重；`test/overview-cursor.test.mjs` 覆盖方向键游标的环绕、切区与越界收敛；`test/count.test.mjs` 覆盖六项口径、分类桶、分区不变量与阈值边界；`test/metric-jump.test.mjs` 覆盖读数跳转座位（可跳指标清单、无铃铛时点击为空操作、按 metric 分发、重发布与销毁语义）；`test/client-mount.test.mjs` 用真实客户端半边挂载，断言铃铛与读数入口、读数五枚 chip 各自跑对应走位（未读复用铃铛游标，已归档不是按钮）、黄色角标只数等待处理、I 的整条往返路径、K 总览的渲染 / 键盘 / 空态 / 关闭、自动恢复的会话停在底部也不确认中断、续跑弹窗的默认全选 / 只发勾选的 / 未勾保持未读 / 同一次启动只问一次、清掉官方手动未读时账本收到 read；`test/row-badge.test.mjs` 覆盖行内绿点的两条纯规则（账本提醒 id 集合、被清掉的手动未读 id）；`test/row-badge-render.test.mjs` 用真组件渲染行内绿点的命中 / 不命中 / 开关；`test/client-render.test.mjs` 用 SSR 真渲染读数与设置行（含「重启后保留未读小标」开关、五个可跳指标是按钮而已归档仍是纯读数、rail 不可点）；`test/client-contract.test.mjs` 覆盖模块 id、inject 清单与三处注册。
- `test/official-contract.test.mjs` 把官方契约钉成快照（已装官方包版本必须落在 `peerDependencies` 内、读数与设置行依赖的字段与槽位、DOM 锚点与 `dsh.workspace.view.v5`），重采用 `node scripts/capture-official-contract.mjs`。
- 构建与分发：`cordis.patch.yml` 是 bundle 层（往 profile 插入 `session-radar` 一行）；`lib/` 是被跟踪的构建产物（Git 安装免 build），改 `src/` 后必须 `npm run build` 并一起提交，CI 会断言提交进库的 `lib/` 与构建产物一致。
- 截图：`scripts/capture-bell.mjs` 从运行实例生成 README 用的截图（headless Chrome，按 `--selector` 裁剪）。`?token=` 是**一次性**登录，第二次跑会落到 `authentication required`；要重复截就传 `--cookie 'dsh-auth-…=v1.…'`（用该实例 `<DSH_HOME>/.credentials.yaml` 里的 `client-connection/browser-session` 密钥现签，脚本只负责注入，不负责签）。
- 续跑弹窗的截图 `assets/retry.png` 有一条更省的受控路径，不需要动操作者的实例、也不需要他退出：**在 `/tmp` 造一个独立的 home**（`cp -a <op-home>/profiles`、`.credentials.yaml`，把 `profiles/web/node_modules` 里指向 home 外的相对软链改成绝对路径），用 `npx -y @deepseek-ai/dsh@0.2.1-alpha.1 --profile web --port <port> --no-open` 起第二个实例（注意：`dsh` 0.1.5-rc.3 **没有** `@deepseek-ai/dsh-client-shortcuts`，客户端半边会因为缺 `shortcuts`/`configForms` 永远 pending，截不到东西），在里面造示例工作区 + 示例会话、跑一个长回合，然后 `kill -9` 那次进程，再起一遍——账本会把遗留的开回合认成中断（这一步同时是「中途退出 → 下次启动未读」的端到端验证）。首启的「预览版说明」弹窗会盖住目标，用 CDP 点一下「继续」再截。截完删掉那个 home 与端口进程。
- 展示类截图 **MUST** 走受控路径：在**示例工作区**（如 `/tmp/<name>-shot-workspace`）里用 `workspace/create` + `session/create` + `session/prompt` 造示例会话，用无头 Chromium 只截目标 UI（不截侧栏其它工作区名、账号、余额），截完立刻 `session/delete` + `workspace/delete` 复原，并在汇报里给出 `session/list` 的复查证据；**MUST NOT** 直接截操作者正在看的真实界面。`assets/overview.png`（⌘⇧K 总览）就是这样产生的。
- 造状态时的两个已知坑：`ask_user_question` 在**没有客户端订阅该会话**时会被立即结算（提问不落地），要么先让 UI 打开该会话再投递，要么改用「手动未读」这类合法来源把另一区补出来；`session/delete` 之前先 `session/cancel`，否则正在跑的回合会被 `dsh-client-auto-continue` 一类插件派生出一条指向同一 `cwd` 的续跑会话，须一并清理并复查 `cwd`。

## 文档约定

- **README 只写使用者视角**：安装、生效、自检、用法、快捷键、限制、安全边界这一类；文件结构、构建命令、测试清单、包管理细节属于维护者内容，**MUST** 放在本文件（或 `CHANGELOG.md` / 脚本头部注释），不要塞回 README。
- 面向用户的文案改动按「键名：旧 -> 新」对照汇报；版本叙事写进 `CHANGELOG.md`，标签与 npm 版本一一对应。

## 目录约定

- `src/ledger.ts` —— 纯账本状态机（无框架依赖，单测直接打它）：`recordTurnStart` / `recordTurnEnd` 维护「当前有没有一个回合开着」（`runningSince`），`adoptAbandonedTurns` 在进程启动时把上一个进程遗留的开回合转成 `interruptedAt`。
- `src/host.ts` —— host 行为：`session/event` 记账、重启孤儿扫描（`session/created` + 启动时扫一遍 live agents 的 `snapshotEvents()`）、`$DSH_HOME/session-radar.json` 原子写、`POST /session-radar/*` 路由（`connection.requestRejection` 鉴权）。`src/index.ts` 只做导出接线。
- `src/count.ts` —— 纯计数口径：`countSessions` 六项（实现为 `classifySessions` 六个桶的长度）、`classifySessions`（每项一个 id 列表，按「最近更新在前」排序，供跳转走位复用）、`countUnarchived`、`normalizeThreshold`、`shouldWarn`；无框架依赖，读数与设置行共用。
- `src/config.ts` —— 指标清单（`METRICS`）、Config 字段名（`METRIC_FIELD`）、默认可见性、版式清单（`VARIANTS`）、行内绿点的偏好（`ROW_BADGE_FIELD` / `DEFAULT_ROW_BADGE` / `normalizeRowBadge`）、`PLUGIN_ID`（= row id = settings 命名空间 = locale NS = `session-radar`）。
- `src/row-badge.ts` —— 行内绿点的纯规则：把账本未读行折成 id 集合（`ledgerUnreadIds`）；无框架依赖，单测直接打它。
- `src/client/retry-model.ts` —— 续跑弹窗的纯逻辑（候选行、勾选、串行发送编排），`RetryDialog.tsx` 只负责渲染；发送动词由 `src/client/index.ts` 注入（见「脆弱契约」）。子代理提醒不直接成行，而是沿 `parentId` 上溯到顶层祖先再合并（`unfinishedSubagentRoots` / `resolveRoot`）。
- `src/overview.ts` —— 「等你处理」总览的纯投影：折叠活动列表自己的行，再切成「待决策」与「未读」两区（无框架依赖，单测直接打它）。
- `src/client/ledger-source.ts` —— 浏览器到账本的唯一桥（同源 `fetch`），把桥接失败**发布**出去而不是吞掉。
- `src/client/ActivityBell.tsx` 铃铛、活动面板与 K 总览弹窗（弹窗 portal 到 `document.body`，全页浮层，不依赖 `wide`）；`jump.ts` 未读选择、当前会话与行定位；`ask-jump.ts` 等待处理跳转的「队列 + 回栈」纯状态机；`overview-cursor.ts` 总览的两区键盘游标（纯状态机）；`jump-command.ts` 三条快捷键命令（未读 J / 等待处理 I / 总览 K）与各自独立的铃铛座位（官方 `ctx.shortcuts`）；`completions.ts` 本地边沿记账；`manual-unread.ts` 读官方侧边栏的「标为未读」并监听其写入（`droppedIds` 给出被操作者清掉的那批 id，供账本回写 read）；`conversation-tail.ts` + `use-conversation-tail.ts` 判断对话是否停在底部（`tailLedgerRead` 决定这次尾读要不要报给账本、要不要带 `acknowledgeInterrupt`）；`use-user-open.ts` 记录「操作者自己打开过哪个会话」（行上的 pointerdown 加铃铛自己发起的跳转）；`anchors.ts` 官方 DOM 锚点；`locales.ts` 文案。
- `src/client/RowBadge.tsx` 会话行行首的绿点：注册进官方 `sidebar.session.row.leading` seat，只读账本快照，命中才渲染官方 `StateDot state="done"`（与官方两条未读来源同一视觉）；`src/client/StatusWatch.tsx` 侧边栏底部读数（胶囊 / 比例条 / rail 三态；五个可跳指标渲染成真按钮，`onClick` 只把 metric 交给 `metricJump` 座位）；`src/client/metric-jump.ts` 读数跳转座位（`JUMP_METRICS` = 六项减 `archived`、`isJumpMetric`、`createMetricJumpSeat`；纯逻辑，单测直接打它）；`SettingsRow.tsx` 设置页偏好行；`config-source.ts` 把 config form 投影成可订阅偏好；`use-counts.ts` 从三个标准 hook 读出六项；`summary.ts` 指标名与一行摘要；`watch-types.ts` 官方 configForms / slots 的结构化类型。
- `src/client/styles.ts` 是**唯一**样式表：`ab-*`（铃铛/面板）、`ov-*`（K 总览浮层）与 `sw-*`（读数/设置行）同在一个 `<style data-plugin="dsh-session-radar">` 里。
- `test/` 与 `src/` 同名对应；`test/watch-harness.mjs` 是读数测试的假 client context 与快照夹具；`scripts/build.mjs`、`scripts/build-tests.mjs` 是构建入口。
- `assets/` —— README 用的真实截图（`bell.png` / `ask-badge.png` 侧栏标题行、`overview.png` K 总览、`retry.png` 续跑清单），都由 `scripts/capture-bell.mjs` 按 `--selector` 裁出来，不含会话名/项目名/账号。
- 依赖官方 DOM 契约：`[data-row-key="session:<id>"]`、`[class*="listArea"]`、`[class*="sectionHeader"]`、`[data-conversation-region="chat"][data-conversation-session]`、`[data-chat-following-tail]`。
- 依赖官方持久化键：Workspace 浏览器的手动未读存在 `localStorage` 的 `dsh.workspace.view.v5` 里，官方改键名会静默失效。

## 合并后的脆弱契约

- **一个 bundle、一个客户端入口**：`lib/client.js` 的模块 id 必须等于包名 `dsh-session-radar`；读数只能作为同一 client 模块里的另一组 `ctx.effect` 注册，不得再挂第二个 `dsh.client` 入口。
- **config 命名空间 = row id = `session-radar`**：设置行的 entry id 与 Config 命名空间都用它。铃铛在 `sidebar.footer.action` 的 entry id 仍是 `session-radar`，读数用 `session-radar.status`（同一个 list slot 不允许重复 entry id）；改名会让 Host 不再服务命名空间、设置行静默消失，但读数仍按默认偏好显示。
- **`inject` 新增必需服务 `configForms`**，且 `dsh.client.inject` 新列了 `@deepseek-ai/dsh-client-ui-settings` 与 `@deepseek-ai/dsh-client-ui-settings-general`：Shell 若不再声明 `settings.general.item`，设置行不注册（读数不受影响）；若 `configForms` 服务本身缺失，整个客户端半边（含铃铛）不会挂载。
- **六项口径只有一份实现**（`src/count.ts`）：读数与设置行共用；筛选依赖 `SessionListState.ids/byId`、`WorkspaceSnapshot.archivedSessionIds` 与 `SessionStatus.running/completionUnread/pendingInteraction`，官方改字段名会静默把数字变成 0 或偏大。
- **活动四项是分区**：`待处理 > 运行中 > 未读 > 闲置`，四者之和恒等于未归档；阈值告警严格大于（第 11 个才告警）。
- **读数/设置行不写任何会话或归档状态**：唯一写入是用户在设置里改的偏好字段。
- **读数的跳转走「座位」而不是自己算**：走位需要游标与已解析的侧边栏锚点，只有挂载中的铃铛有；读数是同一个 footer slot 的另一个 occupant，拿不到这些。所以 `index.ts` 建一个 `createMetricJumpSeat()`，铃铛在挂载期 publish、读数把点击转成 `seat.run(metric)`，没有铃铛时就是空操作。未读 / 待处理两枚直接调用铃铛自己的 `jumpNextUnread` / `jumpNextAsk`（共用同一个游标与回栈），其余三枚走 `classifySessions` 的桶 + 各自游标。**MUST NOT** 让读数自己去 `openSession`：那样会绕过「打开即已读」「行内滚动」这套统一路径。`archived` 不是跳转目标（官方壳拒绝打开归档会话，见 `node_modules/@deepseek-ai/dsh-client-ui-workspace/lib/client.js` 的 `guardedOpen`），它保持纯读数。
- **续跑发送只走官方 Remote**：`src/client/index.ts` 里 `ctx.connection.rpc.call('/api', 'session/prompt', { args: { request } })`（`request = { requestId, sessionId, mode: 'queue', content }`）。这是 API Gateway 自己调所有 Remote 的同一条路，也是唯一稳的：**MUST NOT** 依赖 `ctx.sessions.binding(id)`——本仓类型/已装包（`dsh-api-session-controller` 0.1.5-rc.3）写的是 `binding(id) { return this.resolve(id)?.binding }`（惰性建 scope），而**真正下发给浏览器的构建**是 `binding(id) { return this.scopes.get(id)?.binding }`（只认已 `retainScope` 的 scope），照类型写会 100% 失败（2026-10-08 实测：弹窗里每条都报「这个会话暂时打不开」）。也别走 `agents.resolveAgent` 那类宿主内部接口——`session/prompt` 内部自己 resume 未加载的会话，且不移动操作者的 stage。
- **续跑弹窗每次进程启动只问一次**：host 快照给 `bootAt`（= 进程启动时刻，`src/host.ts`），浏览器把它记进 `localStorage` 的 `session-radar.retryBoot`；同一个 boot 刷新不再弹，重启才再问。改快照字段或那个键名都会让「只问一次」失效。
- **行内绿点只走官方行 seat**：`sidebar.session.row.leading` 是官方行渲染的第三条分支，只在那行主状态 idle 且没有手动未读时渲染，官方自己那两类未读画的是同一个 `StateDot state="done"`。插件在这个 seat 注册 `session-radar.row-badge`（order 10）。**MUST NOT** 改成写官方 `unreadSessionIds`：官方 view store 是私有 handle（`defineStore` 不导出 handle，persist 只在 init 读一次 localStorage、不监听变更），写了本轮页面不刷新，还会污染官方「标为已读」。反向同步只做「手动未读被清 → 账本 read」。
- **快捷键默认位受官方注册表约束**：注册表对**任意**声明 profile 的默认键做重叠检查，撞上官方命令就抛 `Conflicting shortcut defaults`，把整个客户端半边打成 failed。已知占满简单组合的官方命令：`session.search` = 桌面 `Mod+K` / Web `Mod+Alt+K`，`workspace.add` = 桌面 `Mod+O` / Web `Mod+Alt+O`，`workspace.openLocal` = 桌面 `Mod+Alt+O` / Web `Mod+Shift+O`，`workspace.files` = 桌面 `Mod+P` / Web `Mod+Alt+P`。所以 J / I 用 `Mod+Shift`（macOS）与 `Mod+Alt`（Windows/Linux），总览 K 在**所有**平台都用 `Mod+Shift+K`（`Mod+Alt+K` 在 Web 上属于 `session.search`）。新增或改动任何默认键前 **MUST** 先核对官方注册表并在真实实例里做一次激活验证。

## 当前状态与下一步

- 已实现：账本持久化（未读跨刷新/重启）、铃铛角标与跳转读「账本 ∪ 官方 completionUnread ∪ 本地完成边沿 ∪ 官方手动未读」（侧边栏只有铃铛一个入口）、对话停在底部即视为已读（并立刻回写账本 read）、打开会话回写已读、启动自动恢复的会话不确认中断（只有操作者自己打开过的会话，其尾读才算确认）、未读跳转的官方快捷键命令（macOS `⌘⇧J`；Windows/Linux `Ctrl+Alt+J`，可在 设置→通用→快捷键 改键）、待处理提醒（审批/计划审阅/提问在铃铛左上角单独用黄色警告角标计数；I 快捷键先走等待队列、每处理完一个就跳下一个，没有等待项时沿回栈原路返回，辅助键与 J 一致：macOS `⌘⇧I`；Windows/Linux `Ctrl+Alt+I`。字母不能选 O：官方 `workspace.add` / `workspace.openLocal` 已占满 O 的简单组合，注册默认键重叠会挂掉整个客户端半边）。
- 已实现（本次合并）：会话状态读数（六项计数、胶囊 / 比例条、rail 折叠为单图标 + 未归档角标）、设置页逐项开关 + 版式 + 阈值，偏好挂在 row id `session-radar` 的 Config 下（当时八个 volatile 字段，2026-10-08 增至九个）；读数与铃铛在同一 `sidebar.footer.action` 区域（读数 order 890，铃铛 900），仍是一个客户端入口。版本号保持 0.2.0。
- 偏好迁移：`dsh-session-watch` 的旧偏好（row id `session-watch`）**不自动迁移**；两个插件是不同 row，卸载旧插件后在本插件的设置行重设即可（默认值与 0.4.0 相同）。
- 已实现（本次）：**「等你处理」总览**——官方快捷键命令 `session-radar.overview`（全域 `Mod+Shift+K`，Linux Web 无默认键），弹出全页浮层：左列「待决策」按最新更新在前，右区「未读」自适应网格，两区去重（同时待决策又未读的只在左列），↑↓ 区内环绕、←→ 切区、Enter 打开并关窗、Esc / 点遮罩 / 点关闭 / 再按一次 K 关窗；**没有任何等待时命令也可用**，窗口显示一句空态提示（原先 blocked 会让按键毫无反应）。投影是 `src/overview.ts`（折叠 `buildActivityGroups` 的行，口径与角标一致），游标是 `src/client/overview-cursor.ts`。弹窗 portal 到 `document.body`，因此不受侧边栏宽度限制。
- 被打断的判据有三条：账本自己在 `turn/start` 记下的开回合（`runningSince`）在进程启动时若仍留着，就证明上一个进程带着它退出了（`adoptAbandonedTurns`，覆盖 SIGKILL 与没等到修复的情况）；优雅退出的 `aborted` + cause `disposed`（走 `session/event`）；以及崩溃修复补写的 `interrupted`（只存在于存储器快照里，host 靠 `session/created` 与启动扫描读取，因为构造 seed 不发 `session/event`）。
- 已实现（本次）：**「上次中途退出的会话」下次启动就是未读**，`⌘⇧J` 能走到它。三处改动：账本新增 `runningSince` 并在启动时采纳（`LEDGER_VERSION` 1 -> 2，旧文件读作「没有开着的回合」）；`UnreadRow` 新增 `interrupted`，让浏览器半边分得清「没跑完的回合」与「跑完了没看」；尾读改用 `tailLedgerRead`——DSH 自动恢复的那个会话，其尾读不再替操作者确认中断（只有操作者自己打开过的会话才确认），但已完成的回合照旧被读掉。录制方式：行上的 `pointerdown` 与铃铛自己发起的跳转都记进 `use-user-open.ts`。
- 已实现（本次，2026-10-08）：**启动续跑弹窗**。被打断的会话在启动时列成一张清单（默认全勾、正在跑的禁用），按「重试选中」逐条发续跑消息，被接受的那条立刻清未读、被拒绝的保留并显示原因，没勾的保持未读；每次进程启动只弹一次。发送走 `ctx.connection.rpc.call('/api','session/prompt',…)`（见「脆弱契约」），消息文案在 `locales.ts` 的 `retry.continueMessage`（中文即定稿的那句）；**子代理会话自己不列也不发**（宿主对它们返回 `session/not-found`，实测 `delegationDepth: 1`；判据用 `origin === 'subagent'` **或** 有 `parentId`——列表里 172 行带父会话而只有 149 行带 origin），但子代理**没做完**（`running` 为真，或它的提醒是中断回合）时，把它的顶层父会话列出来，多个子代理合成一行（2026-10-08 补：父会话自己回合正常 `completed`、子代理被切断时，两行都被旧规则丢掉，整条任务就停在那儿），续跑消息里让外层会话自己去照看子代理（括号那句写「如果你没有子代理，则忽视这一项。」，**不要**写成「忽略这条消息」，模型会误以为整条续跑指令都可以不理会）。**注意：这推翻了 2026-10-03「账本刻意不含续跑/重发能力」的约定，是 2026-10-08 按使用方要求加回来的**，护栏是本插件永不自动发送（只在你按下按钮时发），自动续跑仍归 `dsh-client-auto-continue` 那类插件；该插件当前已在 Desktop 的 web profile 里被 `setBundleEnabled` 关掉，避免它抢先把清单里的会话发掉。
- 已实现（本次，2026-10-08）：**会话行上的绿色小标跨重启保留**。官方「跑完未看」那类绿点在浏览器内存（`completionUnread`），重启即空；插件把账本未读补进官方为 idle 行留出的 `sidebar.session.row.leading` seat，用官方同一个 `StateDot state="done"` 画点，会话被打开 / 滚到底 / 官方菜单「标为已读」时随账本一起消失（最后一条由 `droppedIds` 把 read 回写账本）。开关是 Config 的第九个 volatile 字段 `showRowBadge`（默认开）。
- 已实现（本次）：**读数图标可点，点了跳到下一个同类会话**。五个可跳指标（运行中 / 未读 / 待处理 / 闲置 / 未归档）渲染成真按钮，点击经 `metricJump` 座位回到铃铛的走位：未读与待处理直接复用铃铛自己的队列（因此与红色角标、`⌘⇧J`、黄色角标、`I` 共用同一个游标），运行中 / 闲置 / 未归档按 `classifySessions` 的桶各自走位（「最近更新在前」，走到末尾绕回第一个）；每次点击都执行「滚到可见 + 打开 + 打开即已读」，与铃铛点行同一条路径。**「已归档」不是按钮**：官方壳拒绝打开归档会话，它保持纯读数；折叠 rail 也保持纯状态。`src/count.ts` 的六项数字改由 `classifySessions` 的桶长度得出，所以「数字」和「走位能到哪」永远是同一份选择。新增文案 `watch.jump` 与 `watch.jumpHint`（后者只在 hover 的整行 tooltip 上）。已知差别：读数的「未读」数字仍是官方 `completionUnread` 口径，而点击走的是铃铛的四路并集——重启后数字可能显示 0 但点了仍会跳。
- 下一步（未做）：把桥接失败（账本快照 `error`）重新露出到铃铛、跨工作区排序；读数的「未读」口径是否并入账本。
