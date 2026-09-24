# 仓库维护约定

## 维护对象

- `codex/AGENTS.md` 是全局指令的唯一维护源。本文件只约束此仓库的维护工作，不部署为全局指令。

## Skill 获取

- 每轮使用前，由 Agent 从 [allurx/agent-skills](https://github.com/allurx/agent-skills) 的 `main` 获取最新完整的 `instruction-structurer` 和 `markdown-tree-view` 目录到 `work/`，无需再次确认；记录实际 commit，本轮生成和校验使用同一版本。
- 读取本次获取的 `SKILL.md` 并核对所需资源，具体用法以该版本文档为准。获取失败或目录不完整时先处理失败，不回退到旧安装副本。

## 结构维护

- 修改维护源时，使用 [instruction-structurer](https://github.com/allurx/agent-skills/tree/main/skills/instruction-structurer)，根据任务目标、内容变化和关联影响选择局部、章节或全文整理，并在维护过程中重新判断范围。
- 现有结构仍适用且影响局部时增量处理；分类体系、跨章节关系或广泛规则发生变化，或局部调整不足以保持语义完整、结构一致和要求可查找时，在已授权范围内全量重审并重组。
- 保留已经合理的部分，不以固定措辞、变更原因或修改数量决定整理范围。
- 对受影响要求做双向语义核对，并检查标题与完整分类路径能否定位要求；大规模移动或合并时，在交付说明中附来源映射。

## 阅读视图与网站产物

- 维护源定稿后，使用 [markdown-tree-view](https://github.com/allurx/agent-skills/tree/main/skills/markdown-tree-view) 随附脚本从完整源文件直接生成 `dist/index.html`，随后对该文件执行 `--check`；仅核对已有视图时不因失配自动重新生成。
- 图标、页面元信息和 CSP 由 Skill 统一生成；版本不支持时报告能力缺口，不在项目侧复制图标或修改 HTML 补齐。`work/` 和 `dist/` 均不纳入版本控制。
- 发布目录只包含 Skill 生成并校验的 `index.html`，部署使用同一份产物。
- 复用对应 Skill 版本的功能验证结果，不在本项目重复图标、配色、布局和交互验收；出现具体集成问题时再做针对性检查。

## 文档站发布

- Agent 按授权直接通过 Wrangler 发布；目标以 [wrangler.jsonc](wrangler.jsonc) 为准，沿用现有域名绑定，日常发布不修改域名。Git 提交和推送不触发网站发布。
- 确认本次使用的 Wrangler 版本，dry-run 与正式发布使用同一版本。发布前核对源文件与已验证产物仍然对应，只部署这份 `dist/`，不在发布阶段重新生成。
- 修改 Wrangler 配置后执行部署 dry-run；dry-run 不证明远端凭据或实际访问正常。
- 发布后核对 `https://codex.allurx.io` 的 HTTPS、响应类型及完整 HTML 与本地产物逐字节一致。回滚采用已验证的历史版本，核对线上结果并修正相关源文件；操作见 [Cloudflare 回滚文档](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/)。

## 本机全局指令部署

- 网站发布与本机全局指令部署独立。按授权将 `codex/AGENTS.md` 部署到实际 Codex 主目录下的 `AGENTS.md`；主目录由 `CODEX_HOME` 指定，未设置时默认为 `%USERPROFILE%\.codex`。
- 部署后逐字节核对维护源与本机生效文件，确认内容一致。

## 交付检查

- 执行 `git diff --check`，报告实际 Skill 版本、源文件与最终产物哈希，以及语义核对、视图一致性和部署的实际结果。
- HTML 校验不代表已部署，文件内容一致不代表新任务已经加载。
