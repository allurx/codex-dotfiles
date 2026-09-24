# 文档站部署

文档树由 [GitHub Actions](../.github/workflows/ci.yml) 构建，通过 Cloudflare Workers Static Assets 发布到 [codex.allurx.io](https://codex.allurx.io)。页面公开包含 `codex/AGENTS.md` 的全部内容。

## 准备

本地需要 Git 和 Node.js 24.12.0 或更新版本，在仓库根目录执行 `npm ci`。每次构建都会查询 [agent-skills](https://github.com/allurx/agent-skills) 仓库 `main` 的最新 commit，并在 `work/tools/` 缓存该 commit 下完整的 `instruction-structurer` 和 `markdown-tree-view` 目录；每次构建均需要网络。

在 GitHub 仓库的 **Settings → Secrets and variables → Actions** 配置：

- Variable：`CLOUDFLARE_ACCOUNT_ID`。
- Secret：`CLOUDFLARE_API_TOKEN`，权限限定到目标 Cloudflare 账号及所需的 Workers 部署操作。

认证配置见 [Cloudflare 的 GitHub Actions 文档](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/)。不需要另外启用 Workers Builds 的 Git 集成。

Fork 后自行部署时，将 [Wrangler 配置](../wrangler.jsonc) 中顶层和 `production` 环境的 Worker 名称改为自己的名称，将 [CI](../.github/workflows/ci.yml) 中访问核验和发布摘要的域名替换为自己的域名，并配置自己 Cloudflare 账号的上述凭据。本文后续的 Worker 名称和域名也应相应替换。

## 构建与检查

```sh
npm run verify
```

此命令先执行 Prettier、ESLint 和 TypeScript 检查，再使用本次查询到的最新 Skill 生成并校验文档树、接入图标，最后检查完整站点并运行部署 dry-run。`work/build-manifest.json` 记录实际使用的 commit 及文件哈希。

单独检查脚本运行 `npm run check:code`，格式化脚本运行 `npm run format`。只检查已有站点产物时运行 `npm run check`，它使用记录的版本和缓存，不联网更新或重建网站。

用浏览器打开 `dist/index.html`，检查标题、正文、源行定位、折叠、配色和窄屏显示；发布后在正式站点核对图标加载。dry-run 不验证远端凭据或实际访问结果。

## 触发与查看

| 操作 | 行为 |
| --- | --- |
| 创建或更新 PR | 构建、校验和部署 dry-run，不发布 |
| 推送 `main` | 验证后部署同一次运行的 HTML artifact |
| Actions → CI → Run workflow，选择 `main` | 重新验证并部署当前 `main` |
| 手动选择其他分支 | 仅验证，不发布 |

在 **Actions → CI** 查看验证、artifact、构建摘要和部署日志；在 **Cloudflare → Workers & Pages → codex-dotfiles → Deployments** 核对版本。旧运行发现 `main` 已更新时跳过部署。

CI 对自定义域名检查 HTTPS、响应类型及 HTML、图标与本次 artifact 逐字节一致。需要手动核对站点时，先确保本地 `dist/` 对应待核对版本，再执行：

```sh
npm run check:deployment -- https://codex.allurx.io
```

## 域名与回滚

自定义域名在 **Cloudflare → Workers & Pages → codex-dotfiles → Settings → Domains & Routes** 绑定。Wrangler 不配置 `routes`，日常 CI 不修改域名。配置要求见 [Cloudflare Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)。`workers.dev` 和版本预览 URL 均关闭。

首次绑定要求 Worker 已有部署；若首轮 CI 在域名就绪前访问检查失败，绑定完成后在 Actions 中重新运行失败作业。

需要回滚时，在该 Worker 的 **Deployments** 选择已验证的历史版本执行 [Rollback](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/)，核对实际页面，并在 Git 中修正对应改动，避免下次推送再次发布问题版本。

## 依赖更新

[Dependabot 配置](../.github/dependabot.yml) 每周检查 npm 依赖和 GitHub Actions，向默认分支 `main` 提交更新 PR。patch/minor 更新通过 `verify` 后由 GitHub 原生自动合并，使用 Squash；major 更新保留人工审查和合并。检查更新日志可在 GitHub 的 **Insights → Dependency graph → Dependabot** 查看。

仓库需开启 **Settings → General → Allow auto-merge**，并为 `main` 设置来自 GitHub Actions 的必需检查 `verify`，要求分支保持最新。[自动合并工作流](../.github/workflows/dependabot-auto-merge.yml) 核对 Dependabot 身份、提交版本及更新类型，确认合并后触发主分支 CI 完成发布；执行记录见 **Actions → Dependabot auto-merge**。没有合并成功时不会触发发布；流程失败可在核对 PR 状态后重跑。原仓库保留管理员直接维护 `main` 的权限。

两个 Skill 在每次构建时从 GitHub 源获取最新版本。单独使用 Skill 维护指令时，先执行 `npm run skills:sync`，再按输出路径读取对应 `SKILL.md` 及所需资源；该命令不重建网站，也不覆盖上次构建记录。
