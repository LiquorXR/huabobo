# 花饽饽 DIY 数字非遗交互系统

"花饽饽 DIY"是一个融合了 **Three.js 3D 引擎**、**MediaPipe 手势识别**与 **AI 大模型**的数字非遗交互系统。用户可通过手势在虚拟空间中捏制、染色并蒸制山东非遗——胶东花饽饽，将作品导出用于 3D 打印，并得到 AI 大师的技法点评。

---

## 🚀 核心技术架构

### 前端：3D 仿真与手势交互
- **渲染引擎 (`app.js`)**：基于 Three.js 构建，支持多图层面团管理、动态光照渲染及多格式（OBJ/STL/3MF）导出。
- **手势识别 (`hand-tracker.js`)**：MediaPipe 手部追踪，EMA 平滑算法消除抖动。单手平移/拉伸，双手协同控制高度。摄像头不可用时静默降级。
- **AI 大师对话 (`master.js`)**：实时截取 3D 作品截图，通过 SSE 流式获取 AI 配色与寓意点评，支持 Thinking 深度思考动画。

### 后端：OpenAI 标准接口 + 配置注入
- **配置注入**：`server.js` 在分发 `index.html` 时动态注入 `window.ENV_CONFIG`，JSON 转义防 XSS。
- **AI 代理**：统一封装 OpenAI 兼容接口（`/v1/chat/completions`），支持**流式 SSE 传输**、**Thinking 思考功能**、**MD5 缓存**。通过环境变量可切换任意兼容服务商（OpenAI / DeepSeek / 其他）。
- **安全防护**：Helmet 安全头（CSP 含 `script-src-attr`），JWT 鉴权，API 限流，通用错误消息防信息泄露。

### 资源管理
- 3D 模型与轮播图统一通过 Admin UI 上传至 `uploads/` 目录，`/api/resources/*` 接口分发。SVG 上传已禁用。

---

## 📂 关键目录

| 目录 | 说明 |
|------|------|
| `public/js/core/` | 3D 场景生命周期 |
| `public/js/modules/` | 手势追踪、AI 通信、蒸制仿真 |
| `public/js/ui/` | 对话框、社区、账号管理 |
| `public/js/api/` | API 客户端（JWT 注入） |
| `public/lib/` | 依赖库本地化托管（Three.js / MediaPipe / Tailwind / Lucide） |
| `src/routes/` | Express 路由（auth / projects / community / admin / resources） |
| `src/models/` | Sequelize 模型定义 + 数据库同步 |
| `src/db/` | 数据库连接配置 |

---

## 🛠 本地开发

### 环境准备
```bash
cp .env.example .env
npm install
```
编辑 `.env`，必须配置：
```ini
OPENAI_API_KEY=sk-your-key
JWT_SECRET=你的复杂随机字符串
```

### 开发命令
| 命令 | 说明 |
|------|------|
| `npm run dev` | Nodemon 热重载开发 |
| `npm start` | 直接启动（单进程） |
| `npm run start:prod` | PM2 cluster 模式启动 |
| `node scripts/setup-https.js` | 生成 HTTPS 自签名证书 |

---

## 🐳 生产部署

### 方式一：Git Clone + 服务器构建（推荐）

```bash
# 服务器上
git clone <repo-url> huabobo && cd huabobo
cp .env.example .env
nano .env    # 填写 OPENAI_API_KEY、JWT_SECRET、DB_PASS
docker compose up -d --build
```

### 方式二：本地构建镜像 + 推送（无需 git clone 到服务器）

**本地操作：**

```bash
# 1. 确认 .dockerignore 已排除 .env 和 uploads/

# 2. 构建镜像
docker build -t registry.example.com/huabobo:latest .

# 3. 测试本地运行（可选）
docker compose up -d

# 4. 推送到镜像仓库
docker push registry.example.com/huabobo:latest
```

**服务器操作：**

```bash
# 1. 创建部署目录
mkdir /opt/huabobo && cd /opt/huabobo

# 2. 创建 docker-compose.yml（image 版，无需 build）
cat > docker-compose.yml <<'EOF'
services:
  web:
    image: registry.example.com/huabobo:latest
    container_name: huabobo_web
    restart: always
    mem_limit: 512m
    mem_reservation: 256m
    cpus: 2
    ports:
      - "3179:3179"
    environment:
      - NODE_ENV=production
      - PORT=3179
      - DB_DIALECT=postgres
      - DB_HOST=db
      - DB_USER=postgres
      - DB_PASS=postgres_password
      - DB_NAME=huabobo
      - DB_PORT=5432
    env_file:
      - .env
    volumes:
      - ./uploads:/app/uploads
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:15-alpine
    container_name: huabobo_db
    restart: always
    mem_limit: 512m
    mem_reservation: 256m
    command: postgres -c max_connections=100 -c shared_buffers=256MB
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres_password
      POSTGRES_DB: huabobo
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d huabobo"]
      interval: 5s
      timeout: 5s
      retries: 5
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
EOF

# 3. 创建 .env
nano .env   # 见下方环境变量表

# 4. 启动
docker compose up -d
```

**本地更新后重新部署：**
```bash
# 本地
docker build -t registry.example.com/huabobo:latest .
docker push registry.example.com/huabobo:latest

# 服务器
docker compose pull && docker compose up -d
```

---

## ⚙️ 环境变量完整参考

| 变量 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `OPENAI_API_KEY` | ✅ | — | OpenAI 兼容 API 密钥 |
| `OPENAI_API_URL` | | `https://api.openai.com/v1` | API 地址（支持 DeepSeek 等） |
| `OPENAI_MODEL` | | `gpt-4o-mini` | 模型名称 |
| `OPENAI_ENABLE_THINKING` | | `false` | 开启深度思考（需服务商支持） |
| `OPENAI_REASONING_EFFORT` | | `high` | 思考强度：`low` / `medium` / `high` |
| `OPENAI_MAX_TOKENS` | | `300` | 每次回复最大 token 数 |
| `JWT_SECRET` | ✅ | — | JWT 签名密钥（≥32位随机字符串） |
| `PORT` | | `3179` | 服务监听端口 |
| `TRUST_PROXY` | | `true` | 信任反向代理 IP（设为 `false` 关闭） |
| `CORS_ORIGIN` | | `*` | CORS 允许域名（生产建议设具体值） |
| `DB_DIALECT` | | `postgres` | 数据库类型 |
| `DB_HOST` | | `db` | 数据库地址 |
| `DB_USER` | | `postgres` | 数据库用户名 |
| `DB_PASS` | | — | 数据库密码 |
| `DB_NAME` | | `huabobo` | 数据库名 |
| `DB_PORT` | | `5432` | 数据库端口 |
| `USE_HTTPS` | | `false` | 本地 HTTPS（仅开发） |
| `HTTPS_KEY_PATH` | | `key.pem` | HTTPS 私钥路径 |
| `HTTPS_CERT_PATH` | | `cert.pem` | HTTPS 证书路径 |

---

## 🌐 Nginx 反向代理 + HTTPS

**包含 SSE 流式传输支持的完整配置：**

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate     /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    client_max_body_size 50m;

    # SSE 流式端点 —— 必须关闭缓冲
    location /api/ask-master {
        proxy_pass http://127.0.0.1:3179;
        proxy_http_version 1.1;
        proxy_buffering off;
        proxy_cache off;
        proxy_set_header Connection '';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }

    # 其他请求
    location / {
        proxy_pass http://127.0.0.1:3179;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

签发证书：
```bash
apt install nginx certbot python3-certbot-nginx -y
certbot --nginx -d your-domain.com
```

---

## 🔒 安全配置

### 防火墙（仅开放 80/443）
```bash
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```
**绝不暴露** 3179（应用）和 5432（数据库）到公网。

### API 鉴权
| 端点 | 鉴权 |
|------|------|
| `POST /api/ask-master` | JWT + 限流 100/15min |
| `/api/projects/*` | JWT |
| `/api/auth/*` (写操作) | JWT |
| `/api/community/:id/like` | JWT |
| `/api/admin/*` | JWT + admin 角色 |
| `/api/community` | 公开（仅 `is_public` 项目） |
| `/api/resources/*` | 公开 |
| `/api/health` | 公开 |

所有 5xx 错误返回通用消息 `"服务器内部错误，请稍后重试"`，真实错误仅记录服务端日志。

---

## 🖨 作品导出
- **OBJ / STL**：兼容主流 3D 建模与切片软件。
- **拓竹 3MF**：Bambu Lab 打印机优化，保留颜色信息，一键切片打印。

---

## 📊 数据库性能要点

| 查询 | 次数 | 索引 |
|------|------|------|
| 社区首页 (20条) | 3 次并行 | `(is_public, createdAt)` 复合命中 |
| 用户项目列表 | 1 次 | `userId` + 分页 `limit`/`offset` |
| 点赞操作 | 2 次 | `projectId` + `(userId, projectId)` 唯一约束 |

生产环境 `sequelize.sync()` 不带 `alter`，避免 PM2 cluster 多 worker 竞态。

---

## 🚦 常用运维命令

| 操作 | 命令 |
|------|------|
| 启动/重建 | `docker compose up -d --build` |
| 停止 | `docker compose down` |
| 清除数据 | `docker compose down -v` |
| 查看日志 | `docker compose logs -f web` |
| 进入容器 | `docker compose exec web sh` |
| 资源占用 | `docker stats` |
| 重启服务 | `docker compose restart` |
| 更新镜像 | `docker compose pull && docker compose up -d` |

---

## 🏮 文化内涵
- **五彩面团**：色盘映射自传统非遗食材（红曲米、菠菜汁、老南瓜等），强调天然染色。
- **大师点拨**：AI 提示词以胶东民间艺术大师口吻进行非遗知识传习。
