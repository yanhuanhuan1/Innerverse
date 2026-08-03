# 方寸万象 / Innerverse

方寸万象是一个面向 AI 图像创作的无限画布工作台。它把项目入口、素材管理、画布组织、提示词输入、文生图、参考图生图、细节增强和角度控制收束到一个更轻量的创作流程里。

Innerverse is an AI infinite-canvas workspace for image creation, editing, enhancement, and visual organization.

## 当前定位

这是当前维护版本，目标是形成一个稳定、容易继续开发的最小 AI 无限画布闭环：

- 在首页创建和打开项目。
- 在无限画布中创建图像节点和提示词输入面板。
- 上传图片，并在画布中拖动、选择、删除和组织。
- 通过 APIMart 接入 OpenAI 兼容的图像与视频模型。
- 将生成结果回写到当前节点和画布状态。
- 保留素材库、API 设置、主题切换和语言切换等基础能力。

## 功能概览

- 首页工作台：项目入口、快速新建、最近项目。
- 无限画布：暗色网格背景、节点选择、拖拽、删除、输入面板。
- 创作节点：文生图、图生图、细节增强、角度控制。
- 模型配置：统一通过 APIMart 作为主要 API 提供方。
- 素材库：本地素材展示与管理。
- 部署：支持本地 Windows 运行，也预留 Vercel 部署入口。

## 本地运行

### Windows 脚本方式

```bat
安装依赖.bat
run.bat
```

启动后打开：

```text
http://127.0.0.1:3000/
```

### 独立虚拟环境方式

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python main.py
```

## API 配置

本项目不把真实 API Key 写入代码或仓库。生产部署请在 Vercel 环境变量里配置：

```env
APIMART_API_KEY=your_apimart_key
APIMART_BASE_URL=https://api.apimart.ai
PUBLIC_BASE_URL=https://your-vercel-domain.vercel.app
```

可选模型覆盖：

```env
APIMART_IMAGE_MODELS=
APIMART_VIDEO_MODELS=
APIMART_CHAT_MODELS=
```

更多部署说明见 [DEPLOYMENT.md](DEPLOYMENT.md)。

## 项目结构

```text
app.py                  Vercel/FastAPI 入口
main.py                 后端服务与 API 适配
static/                 前端页面、画布和素材库
static/home.html        首页工作台
static/canvas.html      经典画布入口（自动跳转智能画布）
static/smart-canvas.html 智能画布（唯一画布引擎，含画布管理入口）
static/asset-manager.html
requirements.txt        Python 依赖
vercel.json             Vercel 路由配置
```

运行时生成的数据、日志、上传素材和本地密钥默认不会提交到 Git。

## Deployment

Innerverse can be deployed to Vercel as a FastAPI app. Import this repository in Vercel, keep the default Python build, and set the APIMart environment variables in the Vercel project settings.

### Email Login

Production project and canvas data is scoped by the logged-in email user. Configure these Vercel environment variables before enabling the site publicly:

```env
DATABASE_URL=your_neon_postgres_url
EMAIL_PROVIDER=resend
RESEND_API_KEY=your_resend_api_key
EMAIL_FROM=方寸万象 <no-reply@your-domain.com>
PUBLIC_BASE_URL=https://your-domain.com
AUTH_SESSION_SECRET=generate_a_long_random_secret
AUTH_COOKIE_SECURE=true
```

Verify your sending domain in Resend before sending login codes to real users. The backend stores only hashed verification codes and hashed session tokens in Postgres; API keys must stay in Vercel environment variables.

Check the deployment health endpoint after release:

```text
/api/health
```

## License

This project is released under the MIT License. See [LICENSE](LICENSE).
