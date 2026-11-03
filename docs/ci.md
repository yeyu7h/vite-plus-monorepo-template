# 持续集成

仓库为 Gitea 和 GitHub 分别提供工作流，两者均验证根目录的 `ready` 命令：代码格式、Lint、类型检查、脚手架测试、默认单元测试与工作区构建。

默认测试由工作区根目录的 `vp test` 统一发现，覆盖各应用与共享包，包括没有单独声明 `test` 脚本的管理端。各项目的专用服务集成测试仍按各自配置单独运行。

| 平台   | 工作流                     | 执行环境                                 |
| ------ | -------------------------- | ---------------------------------------- |
| Gitea  | `.gitea/workflows/ci.yml`  | 自建 Runner，`node:24-bookworm` 任务容器 |
| GitHub | `.github/workflows/ci.yml` | GitHub 托管的 Ubuntu Runner，Node 24     |

工作流监听 `main` 分支推送和 Pull Request。支持 `workflow_dispatch` 的 Gitea 版本也可以手动触发；如默认分支使用其他名称，修改工作流中的 `branches`。

## 接入 Gitea

1. 确认实例启用了 Actions，并在仓库设置中打开 **Enable Repository Actions**。
2. 按所用版本的官方文档安装并注册 Runner，绑定仓库、组织或实例。Runner 主机需要可用的 Docker。
3. 确认 Runner 在线，且带有工作流使用的 `ubuntu-latest` 标签。标签只是任务匹配名称，执行环境由工作流的 `container: node:24-bookworm` 指定。
4. 推送工作流到 Gitea，在仓库 **Actions** 页查看执行结果和日志。

Runner 配置文件中的标签示例（合并到已有配置后重启 Runner）：

```yaml
runner:
  labels:
    - ubuntu-latest:docker://node:24-bookworm
```

如果现有 Runner 使用其他标签，可修改工作流的 `runs-on` 与其匹配。Runner、任务容器均需能访问 Gitea 的仓库地址；使用容器时，应配置它们能解析和访问的域名或网络地址。

Runner 的安装、注册和配置命令以对应版本为准：新版本使用 `gitea-runner`，较早版本使用 `act_runner`。注册令牌在 Gitea 设置中取得并交给 Runner，不写入工作流或仓库。

## 安装与执行

Gitea 工作流使用 Node 24 官方 Debian 镜像，包含 Git 和 Corepack。检出代码后执行：

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm run ready
```

首次安装通过 Corepack 使用根目录 `package.json` 锁定的 pnpm 版本；`ready` 脚本随后使用项目安装的 Vite+。这与本地安装依赖后执行 `vp run ready` 使用同一套检查，不需要在 Runner 主机全局安装 Vite+。

检出步骤使用固定提交的 `actions/checkout` v4，并显式指定 GitHub 来源。任务容器需要能下载该 action、Node 镜像和 npm 依赖。使用内网镜像时，分别替换工作流的 action URL、容器镜像与 npm registry 配置，并保留版本锁定。

## 验证范围

默认 CI 无需数据库、Redis、对象存储或业务密钥，也不执行部署。外部服务集成测试继续使用专用实例及显式的 `TEST_*` 配置，见 [API 测试说明](../templates/template-api/README.md#数据库与测试)。

本地可以先执行 `vp run ready`。工作流放入仓库不会自动安装或注册服务器上的 Runner；最终任务调度、仓库检出与网络连通性需要在目标 Gitea 的 Actions 页面验证。

参考：[Gitea Actions 快速开始](https://docs.gitea.com/usage/actions/quickstart/)、[Runner 标签](https://docs.gitea.com/runner/labels/)、[GitHub Actions 兼容差异](https://docs.gitea.com/usage/actions/comparison/)。
