# codex-dotfiles

个人 Codex 全局协作指令的私有版本仓库。

公开阅读：[全局协作指令文档树](https://codex.allurx.io)。

## 文件与作用域

- [codex/AGENTS.md](codex/AGENTS.md)：全局指令的唯一维护源。
- [AGENTS.md](AGENTS.md)：此仓库的维护约定，不部署为全局指令。
- `work/agents-tree.html`：从维护源生成的本地阅读视图，可重新生成，不纳入版本控制。
- `dist/index.html`：CI 使用固定版本的生成器构建并发布的公开阅读视图，不纳入版本控制。

推送 `main` 后，GitHub Actions 验证并发布文档站；[构建、部署与回滚](docs/deployment.md)见部署说明。

仓库源与本机生效文件分开维护，Git 提交、推送和网站发布均不会替换本机 Codex 全局指令。
