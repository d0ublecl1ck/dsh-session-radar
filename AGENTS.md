# dsh-unread-jump

DSH Web 侧边栏客户端插件：会话跑完在铃铛上留下数字角标，**点一下依次定位并打开下一个未读会话**（到末尾绕回开头）；右键打开「最近活动」列表。
fork 自 `minivv/dsh-activity-bell`（MIT）。上游主交互是「换掉整个侧边栏列表」；侧边栏本来就是会话列表，那份列表回答不了「到底哪个未读」。

## 怎么跑

- 开发：`npm ci`，`npm run verify`（typecheck + build + node 测试）。
- 装进实例：`dsh plugin --profile web add <本目录绝对路径>`，然后刷新页面。
- `lib/` 是**被跟踪的构建产物**：改 `src/` 后必须 `npm run build` 并一起提交，否则安装方拿到旧 bundle。

## 技术栈

- TypeScript（两个 tsconfig）+ esbuild，产物是浏览器模块（`window.__ModuleLoader__.load`，无 JSX 运行时）。
- 测试：`node --test` + jsdom，用真实客户端半边挂载组件。
- 宿主半边是空 `apply`，只为让 `dsh.client` 声明被 client-modules 发现。

## 目录约定

- `src/client/ActivityBell.tsx` 组件与点击行为；`src/client/jump.ts` 未读选择 + 侧边栏行定位；`src/client/completions.ts` 未读记账；`src/client/anchors.ts` 官方 DOM 锚点；`src/client/locales.ts` 文案。
- `test/` 与 `src/` 同名对应；`scripts/build.mjs`、`scripts/build-tests.mjs` 是构建入口。
- 依赖官方 DOM 契约：`[data-row-key="session:<id>"]`、`[class*="listArea"]`、`[class*="sectionHeader"]`。

## 当前状态与下一步

- 已实现：左键顺序定位未读（滚动 + 打开，绕回）、右键最近活动列表、官方 `completionUnread` 与本地边沿记账、折叠分组自动展开、找不到行时降级为只打开会话。
- 下一步：若要「只看未读」筛选或跨工作区排序，先确认官方 `sessions` 快照是否暴露所需字段。
