# Changelog

本项目的版本变更记录。格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循[语义化版本](https://semver.org/lang/zh-CN/)。每次发布对应一个 git tag 与一条 npm 版本。

## [Unreleased]

### 新增

- `⌘⇧K`（Windows / Linux 为 `Ctrl+Shift+K`）弹出「等你处理」总览：左列是待决策的会话（提问 / 审批 / 计划审阅），右区是未读完成的会话网格；`↑↓` 区内移动、`←→` 切区、`Enter` 打开并关窗、`Esc`（或再按一次 K）关掉。没有任何等待时也会打开，并给一句空态提示。

### 修复

- 兼容 DSH `0.2.0-rc` 与 `0.2.1-alpha`：放宽 `peerDependencies` 版本段，安装不再被 `dsh: installation rejected` 拒绝；同时把这条升级路径写进 README 与 `AGENTS.md`。

### 文档

- 记录客户端 bundle 的 `immutable` 缓存行为：插件代码更新后必须硬刷新（`⌘⇧R` / `Ctrl+Shift+R`）才能确认生效，普通刷新可能仍在跑旧 bundle。
- README 收敛为使用者视角：文件结构与开发说明移入 `AGENTS.md`。
- 新增本文件，并为 npm 关键词与仓库 topics 补上 `overview` / `pending` / `shortcuts`。
- 补 `⌘⇧K` 总览的展示截图 `assets/overview.png`：在示例工作区里造出的示例会话，两区各一条（待决策的提问 + 未读的完成），两种状态标签都在图里；截完即删除，图中不含任何真实会话或项目名。

## [1.0.1] - 2026-10-04

### 文档

- README 补「安全边界」与「文件结构」，账本字段折叠进详情。

## [1.0.0] - 2026-10-04

### 变更

- 包名、row id、设置命名空间、路由、账本文件与快捷键命令 id 统一为 `session-radar`（原 `dsh-unread-helper`）；账本由 host 一次性从 `unread-helper.json` 抄入 `session-radar.json`，旧文件保留原地。
- 并入 `dsh-session-watch` 的六项会话状态读数与设置行，并与上游 `dsh-activity-bell` 脱钩。

## [0.1.1] - 2026-09-23

### 文档

- 补徽章、上游链接与相关插件推荐。

## [0.1.0] - 2026-09-23

### 新增

- 首个版本：侧边栏活动铃铛（未读角标与顺序定位）。
