# 对象存储：R2 与 RustFS

每个 API 应用通过自己的环境配置选择一个对象存储后端。上传、下载统一使用 AWS S3 SDK，现有管理端接口保持原有路径与响应字段。

## 选择存储服务

```dotenv
STORAGE_PROVIDER=r2
ACCESS_KEY_ID=your-access-key-id
SECRET_ACCESS_KEY=your-secret-access-key
ENDPOINT=https://your-account.r2.cloudflarestorage.com
BUCKET_NAME=app-files
```

自建 RustFS 时改用对应服务的凭据与地址：

```dotenv
STORAGE_PROVIDER=rustfs
ACCESS_KEY_ID=your-rustfs-access-key
SECRET_ACCESS_KEY=your-rustfs-secret-key
ENDPOINT=http://localhost:9000
BUCKET_NAME=app-files
```

`STORAGE_PROVIDER` 未设置时默认为 `r2`，旧版四项存储配置可继续使用。只接受 `r2`、`rustfs`；类型拼错、凭据为空或地址无效时启动校验失败。修改环境配置后重启 API。

| 配置                       | R2 默认值 | RustFS 默认值 |
| -------------------------- | --------- | ------------- |
| `STORAGE_REGION`           | `auto`    | `us-east-1`   |
| `STORAGE_FORCE_PATH_STYLE` | `false`   | `true`        |

两项均可显式覆盖；留空使用默认值，布尔值只接受 `true`、`false`。启动日志中的 `[ObjectStorage]: 当前存储服务` 显示选中的服务、区域、地址主机和桶名，不记录访问密钥。该日志表示配置选择，实际连通性通过读写验证。

## 区分三种地址

| 配置                       | 用途                                          | 示例                               |
| -------------------------- | --------------------------------------------- | ---------------------------------- |
| `ENDPOINT`                 | 后端直接上传、删除及初始化使用的 S3 地址      | `http://rustfs:9000`               |
| `STORAGE_PRESIGN_ENDPOINT` | 客户端实际访问的 S3 地址，留空沿用 `ENDPOINT` | `https://s3.example.com`           |
| `STORAGE_PUBLIC_BASE_URL`  | 公开资源的完整 URL 前缀，留空时不生成公开链接 | `https://s3.example.com/app-files` |

Docker 服务名 `rustfs` 仅供容器内部访问。网页、小程序使用预签名链接时，需要设置它们能访问的地址。签名按 `STORAGE_PRESIGN_ENDPOINT` 直接生成，不能生成后再替换域名。反向代理应保留请求的 Host、对象路径和查询参数。

公开资源前缀必须包含实际的桶或代理路径映射。例如路径访问方式下 `https://s3.example.com/app-files` 加上对象路径 `avatars/default/v1/example.png`，得到完整图片地址。若图片域名已经代理到桶根目录，可直接填写 `https://img.example.com`。

配置公开域名只负责生成链接。桶默认保持私有，公开头像需要另行配置指定前缀的匿名 `GetObject` 权限，例如 `app-files/avatars/default/*`；上传仍由后端凭据授权。数据库保存长期对象路径，临时签名链接按访问需要生成。

## 可选 RustFS 部署

所有命令从仓库根目录执行。首先准备独立配置：

```bash
cp examples/miniapp-api/.env.rustfs.example examples/miniapp-api/.env.rustfs
```

填写 `ACCESS_KEY_ID`、`SECRET_ACCESS_KEY`、两个 JWT 密钥。访问密钥供此示例创建 RustFS 实例并连接使用，须使用独立值；生产应用可在 RustFS 中创建专用账号并授予目标桶所需权限。设置浏览器实际使用的 `STORAGE_CORS_ALLOWED_ORIGINS`，多个源站用逗号分隔，例如 `http://localhost:5173,https://admin.example.com`。源站包含协议、主机和端口，不含路径或结尾斜杠。

首次部署 API 时，数据库需按原有流程完成迁移与初始化；可以先启动依赖服务，完成数据库准备后再启动 API。此附加配置只自动初始化对象存储的桶与 CORS。

```bash
docker compose --env-file examples/miniapp-api/.env.rustfs \
  -f examples/miniapp-api/compose.yaml \
  -f examples/miniapp-api/compose.rustfs.yaml up -d --build
```

附加配置会选择 RustFS，API 后端地址设为 `http://rustfs:9000`。RustFS 使用固定的 `1.0.4` 镜像和独立数据卷；健康检查通过后，`rustfs-init` 创建缺失的桶并设置浏览器跨域规则，初始化成功后 API 才启动。重复初始化会保留已有对象；初始化使用当前非空跨域来源列表替换该桶的 CORS 规则，不修改桶策略。API 日常启动不会创建桶。

本机默认地址：S3 为 `http://localhost:9000`，控制台为 `http://localhost:9001`；端口默认仅绑定本机。可通过 `RUSTFS_S3_PORT`、`RUSTFS_CONSOLE_PORT` 调整，同时更新客户端预签名地址。本机运行 API 时，将自己的 `.env` 中对象存储配置设为本机可访问地址。

只部署存储与初始化服务：

```bash
docker compose --env-file examples/miniapp-api/.env.rustfs \
  -f examples/miniapp-api/compose.yaml \
  -f examples/miniapp-api/compose.rustfs.yaml up -d --build rustfs-init
```

对已运行的 RustFS，也可以用本机 Node 22.18+ / 24 执行初始化（读取 `.env.rustfs`）：

```bash
vp run @example/miniapp-api#storage:init
```

`.env.rustfs` 已被 Git 忽略，创建新应用时只继承示例文件和部署配置，不复制真实凭据。单节点示例适合开发和小规模使用；生产部署应配置外部 HTTPS 访问、磁盘备份和所需的数据冗余。数据库迁移仍遵循 API 原有流程，对象存储初始化不执行数据库迁移或 seed。

## 业务复用

服务端可以直接上传生成的 PNG：

```ts
import { getObjectStorage } from '@/lib/services/object-storage'

const storage = getObjectStorage()
const result = await storage.putObject({
  key: 'avatars/default/v1/example.png',
  body: pngBytes,
  contentType: 'image/png',
  cacheControl: 'public, max-age=31536000, immutable',
})
// result.key 是持久化对象路径；result.url 在配置公开资源前缀后提供，否则为 null。
```

另提供 `generateUploadUrl`、`generateDownloadUrl`、`getPublicUrl`、`deleteObject`。对象路径支持中文、空格和分级目录；限制在 1024 UTF-8 字节以内，不允许绝对路径、`.` / `..` 路径段、反斜杠或控制字符。

管理端继续调用 `/api/admin/resources/object-storage/upload` 和 `/download`，返回 `{ data: { url, expiresAt } }`。预签名上传使用 PUT，上传请求携带与申请时相同的 Content-Type；有效期默认一小时。头像等业务生成 PNG 后，可调用直接上传方法保存文件。

## 验证

默认单元测试无需存储服务。真实 RustFS 测试单独运行，与 PostgreSQL / Redis 集成测试分开；必须提供专用测试实例、凭据和桶名，缺少任意配置会在加载测试前终止：

```bash
TEST_STORAGE_ENDPOINT=http://localhost:19000 \
TEST_STORAGE_ACCESS_KEY_ID=your-test-access-key \
TEST_STORAGE_SECRET_ACCESS_KEY=your-test-secret \
TEST_STORAGE_BUCKET_NAME=your-dedicated-test-bucket \
vp run @example/miniapp-api#test:storage
```

可选 `TEST_STORAGE_PRESIGN_ENDPOINT` 用于测试外部访问地址，默认使用测试服务地址。测试会创建缺失的测试桶并设置其 CORS，然后验证服务端上传、预签名上传与下载、浏览器预检、私有读取限制及删除。清理仅删除本次随机前缀下的对象，测试桶和 CORS 配置保留。使用具备相应建桶、配置和读写权限的专用凭据。

参考：[RustFS JavaScript SDK](https://docs.rustfs.com/en/developer/sdk/javascript)、[RustFS Docker 部署](https://docs.rustfs.com/en/installation/container/docker)。
