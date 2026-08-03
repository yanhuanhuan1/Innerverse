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
