# dsh-unread-jump

DSH Web 侧边栏**未读铃铛**：会话跑完在铃铛上留下数字角标，**点一下依次定位并打开下一个未读会话**（到末尾绕回开头）；右键才打开「最近活动」列表。

> 本项目 fork 自 [minivv/dsh-activity-bell](https://github.com/minivv/dsh-activity-bell)（MIT，作者 Wei）。
> 上游的主交互是「点铃铛把侧边栏换成按天分组的活动列表」；issue 里的实际使用反馈是：**侧边栏本来就是会话列表，再换一份列表并不能回答「到底哪个未读」**。
> 本 fork 只改这一点：主交互变成「定位」，列表退到右键。

## 行为

| 操作 | 结果 |
| --- | --- |
| 左键点铃铛 | 定位到下一个未读会话：把它的侧边栏行滚动到可见，并在对话栏打开它；再点继续往后走，到末尾绕回第一个 |
| 右键点铃铛 | 打开/关闭「最近活动」列表（保留上游的按天分组视图） |
| 点击列表里的行 | 打开该会话 |
| Esc / 点击侧边栏其它位置 | 关闭活动列表 |

未读的来源与官方侧栏绿点同源：

- 官方 `uiSession.sessionStatus` 的 `completionUnread`（离开时跑完的会话）；
- 加上本插件自己观察到的「运行中 → 结束」边沿（你在场看着它跑完也算），打开该会话即清除。

跳转游标由插件自己持有：即使某个会话的未读状态因为打开而被清掉，连续点击也不会原地打转。

## 已知限制

- 工作区分组**折叠**时那一行不在 DOM 里；插件会先点开该分组再滚动。若展开后仍然找不到（会话被归档、被筛选隐藏、或不在当前列表），则**只打开会话、不滚动**。
- 侧边栏折叠成 56px 轨道时不显示铃铛（该位置的角标被官方占用）。
- 未读不跨刷新保存，与官方一致。
- 依赖官方 DOM 契约 `[data-row-key="session:<id>"]` / `[class*="listArea"]` / `[class*="sectionHeader"]`；官方改版可能失效。

## 安装

```sh
dsh plugin --profile web add /绝对路径/dsh-unread-jump
```

装完刷新页面。卸载：`dsh plugin --profile web remove dsh-unread-jump`。

## 开发

```sh
npm ci
npm run verify    # typecheck + build + 46 个测试
```

测试里 `test/jump.test.mjs` 覆盖选择逻辑（首个/下一个/绕回/游标失效）与分组展开，`test/client-mount.test.mjs` 用真实客户端半边挂载，断言「点一下 → 滚动 + 打开下一个未读」。

## License

MIT（沿用上游）。`LICENSE` 保持上游原文。
