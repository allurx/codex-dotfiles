# 文档站部署

文档树由 [GitHub Actions](../.github/workflows/ci.yml) 构建，通过 Cloudflare Workers Static Assets 发布到 [codex.allurx.io](https://codex.allurx.io)。默认地址为 [codex-dotfiles.allurx.workers.dev](https://codex-dotfiles.allurx.workers.dev)。页面公开包含 `codex/AGENTS.md` 的全部内容，仓库保持私有。

## 准备

本地需要 Git 和 Node.js 24 或更新版本，在仓库根目录执行 `npm ci`。构建会从公开的 [agent-skills](https://github.com/allurx/agent-skills/tree/main/skills/markdown-tree-view) 仓库取得固定 commit 的完整生成器目录，缓存到 `work/tools/`；首次构建需要网络。

GitHub 仓库的 **Settings → Secrets and variables → Actions** 使用以下已有配置：

- Variable：`CLOUDFLARE_ACCOUNT_ID`。
- Secret：`CLOUDFLARE_API_TOKEN`，权限限定到目标 Cloudflare 账号及所需的 Workers 部署操作。

认证配置见 [Cloudflare 的 GitHub Actions 文档](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/)。不需要另外启用 Workers Builds 的 Git 集成。

## 构建与检查

```sh
npm run verify
```

此命令生成 `dist/index.html`，执行生成器 `--check`，再运行部署 dry-run。`work/build-manifest.json` 记录源码与 HTML 哈希及生成器版本。只检查已有 HTML 时运行 `npm run check`，不会重建网站。

用浏览器打开 `dist/index.html`，检查标题、正文、源行定位、折叠、配色和窄屏显示。dry-run 不验证远端凭据或实际访问结果。

## 触发与查看

| 操作 | 行为 |
| --- | --- |
| 创建或更新 PR | 构建、校验和部署 dry-run，不发布 |
| 推送 `main` | 验证后部署同一次运行的 HTML artifact |
| Actions → CI → Run workflow，选择 `main` | 重新验证并部署当前 `main` |
| 手动选择其他分支 | 仅验证，不发布 |

在 **Actions → CI** 查看验证、artifact、构建摘要和部署日志；在 **Cloudflare → Workers & Pages → codex-dotfiles → Deployments** 核对版本。旧运行发现 `main` 已更新时跳过部署。

CI 对默认地址检查 HTTPS、响应类型及 HTML SHA-256 与本次 artifact 一致。需要手动核对任一站点时，先确保本地 `dist/index.html` 对应待核对版本，再执行：

```sh
npm run check:deployment -- https://codex.allurx.io
```

## 域名与回滚

自定义域名在 **Cloudflare → Workers & Pages → codex-dotfiles → Settings → Domains & Routes** 绑定。Wrangler 不配置 `routes`，日常 CI 不修改域名。配置要求见 [Cloudflare Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)。默认 `workers.dev` 地址保持可用，版本预览 URL 关闭。

需要回滚时，在该 Worker 的 **Deployments** 选择已验证的历史版本执行 [Rollback](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/)，核对实际页面，并在 Git 中修正对应改动，避免下次推送再次发布问题版本。
