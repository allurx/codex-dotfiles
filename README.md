# codex-dotfiles

个人 Codex 全局协作指令及文档站的维护仓库。

公开阅读：[全局协作指令文档树](https://codex.allurx.io)。

## 文件与作用域

- [codex/AGENTS.md](codex/AGENTS.md)：全局指令的唯一维护源。
- [AGENTS.md](AGENTS.md)：此仓库的维护约定，不部署为全局指令。
- `work/agents-tree.html`：从维护源生成的本地阅读视图，可重新生成，不纳入版本控制。
- `dist/index.html`：CI 使用构建时最新的 Skill 生成并发布的公开阅读视图，不纳入版本控制。

推送 `main` 后，GitHub Actions 验证并发布文档站；[构建、部署与回滚](docs/deployment.md)见部署说明。

仓库源与本机生效文件分开维护，Git 提交、推送和网站发布均不会替换本机 Codex 全局指令。

## 许可证

本仓库原创的指令正文、维护脚本和图标采用 [MIT License](LICENSE)。外部依赖及构建时获取的 Skill 遵循各自许可证。
