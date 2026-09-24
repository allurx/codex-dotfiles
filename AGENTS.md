# 仓库维护约定

## 维护源与 Skill

- `codex/AGENTS.md` 是全局指令的唯一维护源。本文件只约束此仓库的维护工作，不部署为全局指令。
- 每轮使用前，由 Agent 从 [allurx/agent-skills](https://github.com/allurx/agent-skills) 的 `main` 获取最新完整的 `instruction-structurer` 和 `markdown-tree-view` 目录到 `work/`，无需再次确认；记录实际 commit，本轮生成和校验使用同一版本。获取失败或目录不完整时先处理失败，不回退到旧安装副本。

## 整理与生成

- 修改维护源时，使用 [instruction-structurer](https://github.com/allurx/agent-skills/tree/main/skills/instruction-structurer)，按任务目标、内容变化和关联影响选择局部、章节或全文整理，必要时扩大审查；仅在现有结构不足以保持语义完整、结构一致和要求可查找时重组。
- 维护源定稿后，使用 [markdown-tree-view](https://github.com/allurx/agent-skills/tree/main/skills/markdown-tree-view) 从完整源文件生成并校验 `dist/index.html`，不做项目侧后处理。发布目录只包含该文件，部署使用同一份产物。
- 复用对应 Skill 版本的功能验证结果，不在本项目重复功能和浏览器验收；出现具体集成问题时再做针对性检查。

## 文档站发布

- 通过 Wrangler 发布，目标以 [wrangler.jsonc](wrangler.jsonc) 为准；沿用现有域名绑定，日常发布不修改域名。
- 修改 Wrangler 配置后执行部署 dry-run；dry-run 与正式发布使用同一 Wrangler 版本。
- 发布后核对 `https://codex.allurx.io` 的 HTTPS、HTML 响应类型，以及完整 HTML 与本地产物逐字节一致。

## 本机全局指令部署

- 网站发布与本机全局指令部署独立。将 `codex/AGENTS.md` 部署到实际 Codex 主目录下的 `AGENTS.md`；主目录由 `CODEX_HOME` 指定，未设置时默认为 `%USERPROFILE%\.codex`。部署后逐字节核对源与目标，确认内容一致。

## 交付检查

- 执行 `git diff --check`。
