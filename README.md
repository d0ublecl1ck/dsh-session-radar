# dsh-session-ledger

DSH Web 侧边栏**未读铃铛 + 跨重启会话账本**。

铃铛回答「哪个未读、下一个在哪」；host 侧的账本回答「重启之后这些事还在不在」。两者读同一份数据。

> fork 自 [minivv/dsh-activity-bell](https://github.com/minivv/dsh-activity-bell)（MIT，作者 Wei）。上游把「点铃铛」做成换一份活动列表，本 fork 先把它改成**顺序定位未读**，之后又在本 fork 上加了 host 账本与「被重启打断」的处理。

## 行为

| 操作 | 结果 |
| --- | --- |
| 左键点铃铛 | 定位到下一个未读会话：滚动到可见并在对话栏打开；再点继续往后走，末尾绕回第一个 |
| 快捷键 | 与左键点铃铛同一个跳转，默认 macOS `⌘⇧J`、Windows / Linux `Ctrl+Alt+J`，在 设置 → 通用 → 快捷键 改键 |
| 右键点铃铛 | 打开/关闭「最近活动」列表（按天分组） |
| 点列表里的行 | 打开该会话 |
| 在某会话行右键 →「标为未读」 | 该会话计入铃铛角标与跳转顺序，直到被打开；标记由官方侧边栏持有，插件只读 |
| 在会话里滚到底部 | 该会话视为已读：角标与账本已读一并回落，再往上滚也不会重新变未读 |
| Esc / 点侧边栏其它位置 | 关闭活动列表 |
| chip（只有存在被打断的会话时才出现） | 显示红色 `⚠ N`；点开列出被重启打断的会话，顶部一个「全部继续」 |

## 快捷键

快捷键是官方命令 `session-ledger.jumpUnread`，通过 `ctx.shortcuts` 注册，所以出现在 设置 → 通用 → 快捷键 里，可以改键，也和其它命令一起做冲突检测。执行的就是铃铛左键的同一个跳转（共享同一个游标）。

| 运行端 | 默认 |
| --- | --- |
| macOS（Desktop / Web） | `⌘⇧J`（`Mod+Shift+J`） |
| Windows / Linux | `Ctrl+Alt+J`（`Mod+Alt+J`） |
| Web Linux | 不绑默认（服务只放行三个固定组合） |

macOS 只能用 `Mod+Shift+J`，是两个约束卡在一起的结果：macOS Desktop 的 preload 会设 `data-dsh-desktop-web-shortcuts="true"`，runtime 因此是 `web`，所以（1）单 `⌘+字母` 被 Web 规则判 `unsupported-browser` 直接禁用——官方 `⌘K` 就因此无反应；（2）`⌘⌥U` 虽然注册合法，但 `Option+U` 是 macOS 死键，DOM 分发器把死键当输入法组合丢弃，框架只对 `⌘⌥N` 硬编码豁免。`Mod+Shift+J` 两个坑都躲开。R 系组合被官方 `session.rename`、`page.refresh` 占用；`⌘U` 则属于 Desktop 菜单的「检查更新」。要在 Web 改键，也在 设置 → 通用 → 快捷键 里录一个服务允许的组合；Web 默认值只保证注册合法，浏览器是否真的把按键送到页面仍需实测。

## 未读从哪来（跨重启）

host 半边持有账本 `$DSH_HOME/session-ledger.json`，原子写（临时文件 + rename）：

| 字段 | 含义 |
| --- | --- |
| `lastTurnEndAt` / `lastTurnEndKind` | 最后一次 durable 轮次边界（completed / aborted / blocked / max-tokens…） |
| `lastAttentionAt` / `lastAttentionKind` | 最后一次待交互（approval / question） |
| `interruptedAt` | 被宿主退出切断的那一轮（`turn/end` 的 `aborted` + cause `disposed`） |
| `lastReadAt` | 操作者最后确认到的时间 |

- 未读 = `interruptedAt` 有值，**或** `max(turnEnd, attention) > lastReadAt`
- 记账来源：`session/event` 的 `turn/end` 与 `approval/asked`，加上 `ask_user_question` 的工具分发
- 已读 = 打开该会话（铃铛跳转或 chip 点行）｜在该会话发新消息｜把该会话的对话滚到底部
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

- 判定：最后一次 `turn/end` 是**重启**造成的，不是操作者造成的。两条信号都算：
  - 优雅退出：宿主动态 dispose 会在 `session/event` 上发 `aborted` + cause `disposed`
  - 崩溃修复：DSH 给没结束的尾回合补一条 reason `interrupted` 的 `turn/end`。它作为构造 seed 注入，**永远不发 `session/event`**，所以 host 在 `session/created`（外加启动时扫一次 live agents）读 `session.snapshotEvents()` 找它
  - 其后出现 `turn/start` 或 `user/message` 视为已被取代，不再算被打断
- chip 显示 `⚠ N`，点开可逐个打开
- 「全部继续」发送固定文本（行配置 `continueMessage` 可覆盖）：

  `上次执行被 DSH 重启中断，请先核对当前文件与命令的真实状态，再继续。`

- 投递是**串行**的：上一个跑完（或 10 分钟超时）才发下一个，避免多个 agent 同时改同一批文件
- 续跑消息用官方的 `createUserMessage` 构造（`source: {kind:'user'}`），不手搓 message；宿主拒收或投递失败会写进 rollout 状态并在 chip 上显示，而不是只进控制台

## 通道

host 半边注册一条自己的路由：

```
POST /session-ledger/<endpoint>        endpoint: list | read | continue-all
```

handler 第一件事是 `connection.requestRejection(req)` —— 信任与鉴权复用连接服务自己的栅栏（与 `dsh-host-open-in-app` 同款）。带会话 cookie → 200，不带 → 401。

不用 Typert Remote 的原因：手写的 contribution 没有平台生成的 Remote 元数据，`ctx.remote.$mount()` 会在网关的 `validateContribution` 里被拒。

## 已知限制

- 依赖官方 DOM 契约 `[data-row-key="session:<id>"]` / `[class*="listArea"]` / `[class*="sectionHeader"]`，官方改版可能失效。
- 「滚到底部=已读」依赖官方对话区契约 `[data-conversation-region="chat"][data-conversation-session]` 与 `[data-chat-following-tail]`；属性不存在时这一路静默失效，退回「切走再切回才算已读」的旧行为。
- 工作区分组**折叠**时那一行不在 DOM 里：插件先点开分组再滚动；展开后仍找不到（归档、被筛选隐藏、不在当前列表）则**只打开、不滚动**。
- 侧边栏折叠成 56px 轨道时不显示铃铛（该位置被官方占用）。
- 崩溃（进程被强杀）走修复补写的 `interrupted`；会话不暴露 `snapshotEvents()` 也不暴露 `events` 时这一路静默失效。
- 任何在重启后自动向被打断会话发消息的插件，都会让新回合结束时清掉标记、chip 随之消失；要保留手动「全部继续」，就得关掉那类插件的启动自动续跑。
- chip 上的红色 `!` 表示浏览器到 host 的桥接失败：此时保留上一次已知数据，不清空。
- 手动「标为未读」不在任何公开快照里：插件直接读 Workspace 浏览器持久化的私有键 `dsh.workspace.view.v5`。官方改键名时这一路会静默失效，其它未读来源不受影响。
- 快捷键默认值同时受官方服务、macOS 死键与 Desktop 菜单限制：macOS Desktop 以 `web` runtime 分发，单 `⌘+字母` 被判 `unsupported-browser`（官方 `⌘K` 也失效），`⌘⌥<死键>`（如 `U`）被当输入法组合丢弃，`⌘U` 又归 Desktop 菜单「检查更新」，R 系撞官方 `session.rename` / `page.refresh`，所以 macOS 用 `⌘⇧J`、Windows/Linux 用 `Ctrl+Alt+J`；Linux Web 只放行三个固定组合，没有默认键。

## 安装

```sh
dsh plugin --profile web add /绝对路径/dsh-session-ledger
```

装完刷新页面。卸载：`dsh plugin --profile web remove dsh-session-ledger`。

**改完 host 半边必须 `remove` + `add`**：模块按 URL 缓存，只 `add` 不会重新导入。

## 开发

```sh
npm ci
npm run verify    # typecheck + build + 88 个测试
```

`test/ledger.test.mjs` 覆盖账本状态机（未读、已读不回退、两种重启信号、存储器尾部扫描）；`test/host.test.mjs` 用假 ctx 挂载 host 半边，断言恢复扫描、live 清除与畸形输入；`test/jump.test.mjs` 覆盖未读选择与分组展开；`test/jump-command.test.mjs` 覆盖快捷键命令的座位、默认键位与 blocked/handled 解析；`test/manual-unread.test.mjs` 覆盖官方手动未读标记的解析与监听；`test/conversation-tail.test.mjs` 覆盖「对话在底部」的锚点；`test/client-mount.test.mjs` 用真实客户端半边挂载，断言铃铛与 chip 两个入口。

## License

MIT（沿用上游）。`LICENSE` 保持上游原文。
