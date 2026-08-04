# Deploying 方寸万象 / Innerverse

Innerverse can run locally with the existing Windows scripts, and can also be deployed to Vercel as a FastAPI app.

方寸万象可以在本地通过现有 Windows 脚本运行，也可以作为 FastAPI 项目部署到 Vercel。

## Vercel Environment Variables

Set these in **Vercel Project Settings -> Environment Variables**.

Required for production:

```env
DATABASE_URL=your_neon_postgres_url
APIMART_API_KEY=your_apimart_key
EMAIL_PROVIDER=resend
RESEND_API_KEY=your_resend_api_key
EMAIL_FROM=方寸万象 <no-reply@your-domain.com>
PUBLIC_BASE_URL=https://your-domain.com
AUTH_SESSION_SECRET=generate_a_long_random_secret
AUTH_COOKIE_SECURE=true
```

Optional R2 media storage:

```env
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_BASE_URL=
```

必填：

```env
APIMART_API_KEY=your_apimart_key
```

可选：

```env
APIMART_BASE_URL=https://api.apimart.ai
APIMART_IMAGE_MODELS=
APIMART_VIDEO_MODELS=
APIMART_CHAT_MODELS=
PUBLIC_BASE_URL=
PUBLIC_MEDIA_BASE_URL=
```

Optional CORS allow-list:

```env
ALLOWED_ORIGINS=https://your-frontend-domain.example
```

`ALLOWED_ORIGINS` is a comma-separated list of origins allowed to call this API
from the browser. Leave it empty to allow the local dev origins
(`http://127.0.0.1:3000`, `http://localhost:3000`). Requests served from the
same origin (the FastAPI app itself) never need CORS.

Model variables are comma-separated. Leave them empty to use the built-in APIMart model lists.

模型列表变量使用英文逗号分隔。留空时会使用项目内置的 APIMart 模型列表。

After the first deployment, set `PUBLIC_BASE_URL` to your production URL if an upstream model needs to fetch uploaded media by URL.

首次部署完成后，如果上游模型需要通过 URL 读取上传素材，请把 `PUBLIC_BASE_URL` 设置为你的 Vercel 生产域名。

## Deploy From GitHub to Vercel

1. Push this repository to GitHub.
2. Create a new Vercel project and import the GitHub repository.
3. Keep the default Python/FastAPI detection. The Vercel entry is `app.py`.
4. Add the environment variables above.
5. Deploy.
6. Open `/api/health` to confirm the runtime and APIMart configuration.

## Email Login Setup

1. Verify your production sending domain in Resend, for example `innerverse.top`.
2. Set `EMAIL_FROM` to an address on that verified domain, for example `方寸万象 <no-reply@innerverse.top>`.
3. Set `RESEND_API_KEY` in Vercel. Do not expose it in frontend code.
4. Set `AUTH_SESSION_SECRET` to a long random value. You can generate one with:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

After login, projects, canvases, and canvas generation tasks are scoped by the email user id stored in Neon/Postgres.

## Local Development

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python main.py
```

Then open:

```text
http://127.0.0.1:3000/
```

## Do Not Commit

Do not commit local runtime files, generated media, logs, or real API keys.

不要提交本地运行文件、生成素材、日志或真实 API Key。

These paths are ignored by `.gitignore`:

```text
API/.env
.env
python/
packages/
assets/
output/
data/canvases/
data/conversations/
data/media_previews/
server*.log
server.pid
```

## Runtime Notes

Vercel Functions have an ephemeral filesystem. Runtime canvas data and uploaded files may be lost between deployments or cold starts.

Vercel Functions 的文件系统是临时的。生产环境如需长期保存画布、素材和生成记录，下一阶段建议接入对象存储和数据库，例如 Vercel Blob、S3-compatible storage、Postgres 或 Redis。

## Frontend Build

前端做了内容级拆包（canvas-core + 按需加载 chunk）与 Lucide 精简构建。构建命令：

```bash
npm install --no-audit --no-fund
npm run build   # 运行 build.mjs：压缩核心与 chunk、生成 lucide-slim、内容 hash 与 manifest，并改写 canvas.html 引用
```

构建产物输出到 `static/js/build/`（带内容 hash）并提交到仓库；Vercel 部署直接使用提交的产物（不在 Vercel 上跑前端构建，避免自定义 buildCommand 干扰 Python 依赖安装）。修改 `canvas.js`/分块源码后，先在本地执行 `npm run build` 再把产物一起提交。静态中间件对 `/static/js/build/` 按 immutable 长期缓存；`canvas.html` 只引用 `manifest.js` + 带 hash 的 `canvas-core` 与 `lucide-slim`，非首屏功能（日志/灯箱/导出/工作流/媒体/节点渲染器）由核心按需加载对应 chunk。

## Database Connection (Vercel + Neon)

画布数据存储在 Postgres（生产推荐 Neon）的 `kv_documents` 表中。连接策略：

1. **Vercel 环境变量 `DATABASE_URL` 必须使用 Neon 的 "Pooled connection"**
   （pgBouncer，主机名带 `-pooler` 的字符串），而不是直连地址。代码无需区分，
   连接字符串决定走池化还是直连。
2. 代码在同一个函数实例内会复用数据库连接（模块级缓存），不会每次请求重新建连；
   但 Vercel 冷启动的新实例仍会建立一次新连接，因此池化 + 保活缺一不可。
3. 数据库连接失败时会自动降级到本地文件存储路径，已有重试逻辑保持不变。
4. 不要在任何配置里硬编码连接字符串或密钥；通过 Vercel 环境变量注入。

## Keeping the Database Warm

If your Postgres provider pauses idle compute (Neon free tier pauses after ~5
minutes of inactivity), the first request after idle can take 5-10 seconds to
reconnect — this usually shows up as the home page loading slowly when you open
the site. Two things help:

1. Use a **pooled connection string**. In Neon, copy the "Pooled connection"
   (pgBouncer, `-pooler` host) string into `DATABASE_URL` instead of the direct
   one. Pooled connections survive cold starts much better.
2. `/api/health` pings the database (`SELECT 1`) when `DATABASE_URL` is set,
   so you can point an external uptime/warm-up monitor at it. A Vercel Cron
   every few minutes would keep the compute awake too, but the Hobby plan only
   allows one cron run per day — so either upgrade to Pro and add a cron, or
   use a third-party uptime service (e.g. UptimeRobot) hitting `/api/health`
   every 5 minutes.

Note: keep `vercel.json` free of `crons` on Hobby — an unsupported cron
expression makes Vercel reject every deployment before the build starts.

## Region / Pooled-Connection / Autopause Checklist (console, no secrets)

These settings cannot be fully verified from code; confirm them once in the
Neon / Vercel / Cloudflare dashboards:

1. **Neon**
   - Use a **Pooled connection** (pgBouncer, host contains `-pooler`) for
     `DATABASE_URL` on Vercel. Code keeps a module-level reusable connection
     per function instance and rebuilds it automatically when it drops, so no
     per-request reconnect should happen.
   - Prefer a Neon compute region near your Vercel function region (e.g. both
     in `hkg1` / `singapore` / `iad1` — pick one pair and use it for both).
   - Check the autopause setting: if you see multi-second cold starts after
     idle, either disable autopause (paid plan), or keep the compute awake
     with an uptime monitor hitting `/api/health` every few minutes.
2. **Vercel**
   - Function region: set the project's Function Region to the same region as
     Neon (Vercel dashboard → Project → Settings → Functions).
   - Do NOT add a custom `buildCommand` that skips Python dependency
     installation. Rely on the committed build artifacts in `static/js/build`
     and the CI build-consistency job instead.
   - Environment variables to configure (names only, never commit values):
     `DATABASE_URL` (Neon pooled), `AUTH_SESSION_SECRET`, `PUBLIC_BASE_URL`,
     optional `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` /
     `R2_BUCKET_NAME` / `R2_PUBLIC_BASE_URL`, `APIMART_API_KEY`,
     `RESEND_API_KEY`, `EMAIL_FROM`.
3. **Cloudflare R2** (if used)
   - Bucket region should be close to Vercel/Neon; a public bucket domain
     (or a public URL) is required for CDN-direct media URLs.
   - `R2_PUBLIC_BASE_URL` must match the actual public bucket URL; otherwise
     media falls back to API-served paths (still works, but goes through the
     function).

## Build / CI / Deploy Flow

- `npm run build` regenerates `static/js/build/` with content-hashed filenames,
  a unified `buildId`, and writes the core/lucide references **and** an inline
  `window.CANVAS_BUILD` mapping directly into `static/canvas.html`, so a normal
  canvas open does not request the runtime `manifest.js` (the manifest file is
  kept only for the homepage prefetch and loader fallback).
- GitHub Actions CI (`ci.yml`) now enforces:
  `npm ci` → `npm run build` → content-hash consistency check →
  fail if the build produces uncommitted changes → backend `unittest` →
  local smoke (assets, manifest, chunks, `/api/health`, `/api/warmup`,
  cache headers, Range).
- Do not set a custom Vercel `buildCommand`; Python dependencies must be
  installed by Vercel's default Python runtime from `requirements.txt`.

## Performance Metrics

- Frontend sends `marks`, `metrics` (e.g. `project_click->canvas_ready`,
  `document_loaded->canvas_ready`, `canvas_api_start->canvas_api_complete`,
  `render_start->canvas_first_frame`) and safe `meta` (node/connection/media
  counts, canvas payload bytes, core cache hit) to `POST /api/perf` with a
  `phase` of `cold` / `warm` / `homepage-warmed` / `prefetched`.
- Backend stores metrics in Neon `perf_events` (and an in-memory ring as
  fallback), then `GET /api/perf/summary?hours=24` returns P50/P75/P95 per
  phase + metric. No user content, node text, media URLs, canvas IDs or
  database connection strings are recorded.
