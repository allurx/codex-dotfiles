# 仓库维护约定

## 维护对象

- `codex/AGENTS.md` 是全局指令的唯一维护源。本文件只约束此仓库的维护工作，不部署为全局指令。

## Skill 获取

- 每次使用本工程的 `instruction-structurer` 或 `markdown-tree-view` 前，执行 `npm run skills:sync`，从 GitHub 源仓库 `allurx/agent-skills` 的 `main` 获取最新完整目录到项目缓存，无需再次确认。
- 按命令输出的路径读取本次同步的 `SKILL.md` 并核对所需资源。同步失败时先处理失败，不回退到旧安装副本。

## 结构维护

- 修改维护源时，使用 [instruction-structurer](https://github.com/allurx/agent-skills/tree/main/skills/instruction-structurer)，根据任务目标、内容变化和关联影响选择局部、章节或全文整理，并在维护过程中重新判断范围。
- 现有结构仍适用且影响局部时增量处理；分类体系、跨章节关系或广泛规则发生变化，或局部调整不足以保持语义完整、结构一致和要求可查找时，在已授权范围内全量重审并重组。
- 保留已经合理的部分，不以固定措辞、变更原因或修改数量决定整理范围。
- 对受影响要求做双向语义核对，并检查标题与完整分类路径能否定位要求；大规模移动或合并时，在交付说明中附来源映射。

## 阅读视图

- 本轮维护源修改定稿后，使用 [markdown-tree-view](https://github.com/allurx/agent-skills/tree/main/skills/markdown-tree-view) 随附脚本从完整源文件生成或更新 `work/agents-tree.html`，随后执行 `--check`。HTML 是本地派生产物，不手工修改其中的规则正文，不纳入版本控制。
- 仅核对已有视图时使用 `--check`，失配不自动触发重新生成。
- 生成后用浏览器抽查受影响的标题、正文、源行定位与折叠操作；无法进行浏览器检查时说明未验证范围。具体命令与使用方式见当前加载的 `markdown-tree-view` Skill 文档。

## 本机部署

- 按授权将 `codex/AGENTS.md` 部署到实际 Codex 主目录下的 `AGENTS.md`；主目录由 `CODEX_HOME` 指定，未设置时默认为 `%USERPROFILE%\.codex`。
- 部署后逐字节核对维护源与本机生效文件，确认内容一致。

## 文档站

- 网站发布 `codex/AGENTS.md` 的完整 HTML 阅读视图及 `site/` 图标资源；每次构建获取最新 Skill，并记录实际使用的 commit。配置与入口见 `scripts/document-tree.ts`，操作见 `docs/deployment.md`。
- `dist/` 是 CI 交付目录，`work/agents-tree.html` 是本地阅读视图；两者均不纳入版本控制。不要修改生成的规则正文。
- 部署使用同一次验证通过的 artifact，不在部署步骤重新构建；网站发布与本机全局指令部署互相独立。
- 修改构建脚本、workflow 或 Wrangler 配置后执行 `npm run verify`；线上发布后核对实际 HTML 内容，并按阅读视图要求抽查浏览器交互。
- `scripts/` 使用 Node.js 原生执行的 TypeScript；按 `tsconfig.json` 的严格配置检查，仅使用可擦除的类型语法。代码检查入口为 `npm run check:code`。

## 交付检查

- 关键行为规则修改后的场景选择、执行与结果记录见 [全局指令行为验证](docs/instruction-validation.md)。
- 执行 `git diff --check`，分别报告语义核对、视图一致性和浏览器检查的结果。
- HTML 校验不代表已部署，文件内容一致不代表新任务已经加载。
