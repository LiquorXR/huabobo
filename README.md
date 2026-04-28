# 花饽饽 DIY 数字非遗交互系统

“花饽饽 DIY”是一个融合了 **Three.js 3D 引擎**、**MediaPipe 手势识别**与 **Gemini 大模型**的数字非遗交互系统。用户可以通过手势在虚拟空间中捏制、染色并蒸制山东非遗——胶东花饽饽，最后将其导出用于 3D 打印。

---

## 🚀 核心技术架构

### 1. 前端：3D 仿真与手势交互
- **渲染引擎 (`app.js`)**：基于 Three.js 构建。支持多图层面团管理、动态光照渲染及多格式（OBJ/STL/3MF）导出。
- **手势动力学 (`hand-tracker.js`)**：
  - **单手模式**：实现 X-Z 平面的水平平移与 Y 轴的拉伸（捏合手势）。
  - **双手协同**：锁定水平位移，通过双手高度差精确控制面团在垂直空间的落位。
  - **状态机控制**：内置 EMA（指数移动平均）平滑算法，解决摄像头丢帧导致的抖动问题。
- **视觉反馈**：通过垂直投影（Drop Shadow）辅助线，增强用户在 3D 空间中的距离感。

### 2. 后端：环境感知与 AI 代理
- **配置注入**：`server.js` 在分发 `index.html` 时，动态注入服务端环境变量（如 AI 模型版本），实现前、后端配置同步。
- **API 代理**：统一封装对 Gemini API 的调用，实现多模态（截图 + 提示词）分析，由“AI 大师”提供专业的配色与文化寓意点评。

### 3. 资源管理与扩展
- **模型与轮播资源**：当前项目不再依赖 `public/models/` 下的静态模型清单。3D 模型与首页轮播图统一通过 Admin UI 上传，并存储在数据库中，由 `/api/resources/*` 接口分发给前端使用。

---

## 📂 关键目录说明

- `public/js/core/`：系统的“大脑”，负责 3D 场景的生命周期。
- `public/js/modules/`：功能插件化，包含手势追踪、AI 通信、蒸制仿真等核心逻辑。
- `public/lib/`：为了确保在展览等弱网环境下运行，所有核心依赖（MediaPipe/Three.js）均已实现本地化托管。
- `scripts/`：包含本地 HTTPS 证书生成脚本。
- `database/`：存放 SQLite 数据库文件。

---

## 🛠 开发与运行

### 环境准备
1. 创建 `.env` 文件，配置你的 `GEMINI_API_KEY`。可以参考 `.env.example`。
2. 安装依赖：`npm install`

### 开发指令
- `npm run dev`：使用 nodemon 启动开发服务器。
- `node scripts/setup-https.js`：生成本地自签名证书（如需测试 HTTPS 访问，且 `.env` 中 `USE_HTTPS=true`）。
- `npm start`：生产环境运行。

---

## 🚢 生产环境部署 (Docker)

本项目默认可直接使用 SQLite 进行本地开发；如需容器化部署，也保留了基于 Docker Compose + PostgreSQL 的部署方式。

### 前提条件

VPS 上需已安装 Docker 和 Docker Compose（Ubuntu/Debian）：

```bash
curl -fsSL https://get.docker.com | bash
apt install docker-compose-plugin -y
```

### 部署步骤

1. **克隆代码**：
   ```bash
   git clone https://github.com/LiquorXR/huabobo.git
   cd huabobo
   ```

2. **环境变量配置**：
   ```bash
   cp .env.example .env
   nano .env
   ```

   必须填写的项：

   ```ini
   GEMINI_API_KEY=你的真实Gemini_API_Key
   GEMINI_MODEL=gemini-3.1-flash-lite-preview
   JWT_SECRET=生成一个复杂随机字符串（至少32位）

   DB_DIALECT=postgres
   DB_HOST=db
   DB_USER=postgres
   DB_PASS=设置一个强密码
   DB_NAME=huabobo
   DB_PORT=5432
   ```

   > **注意**：`DB_HOST=db` 对应 docker-compose 中的 PostgreSQL 服务名，不要改成 localhost。如需自定义数据库密码，请在 `docker-compose.yml` 中同步修改 `db` 容器和 `web` 容器的密码。

3. **一键启动**：
   ```bash
   docker compose up -d --build
   ```
   首次构建会安装依赖、拉取 PostgreSQL 镜像并打通网络。后续代码更新后重新执行该命令即可。

4. **验证部署**：
   ```bash
   # 查看容器状态
   docker compose ps

   # 查看日志
   docker compose logs -f web

   # 健康检查
   curl http://localhost:3179/api/health
   ```
   浏览器访问 `http://<服务器IP>:3179`，服务启动后 Sequelize 会自动同步数据库表结构。

### 配置反向代理 + HTTPS

项目本身监听 HTTP 3179 端口，建议使用 Nginx 反向代理统一处理 HTTPS。

1. **安装 Nginx + Certbot**：
   ```bash
   apt install nginx certbot python3-certbot-nginx -y
   ```

2. **创建站点配置** `/etc/nginx/sites-available/huabobo`：
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;

       location / {
           proxy_pass http://127.0.0.1:3179;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           client_max_body_size 50m;
       }
   }
   ```

3. **启用并签发 SSL**：
   ```bash
   ln -s /etc/nginx/sites-available/huabobo /etc/nginx/sites-enabled/
   nginx -t
   systemctl reload nginx
   certbot --nginx -d your-domain.com
   ```

### 防火墙配置

VPS 只开放 80/443 端口，**不要**直接暴露 3179（应用端口）或 5432（数据库端口）到公网：

```bash
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

### 常用管理命令

| 操作 | 命令 |
|------|------|
| 启动 | `docker compose up -d --build` |
| 停止 | `docker compose down` |
| 停止并清除数据库 | `docker compose down -v` |
| 重启 | `docker compose restart` |
| 查看日志 | `docker compose logs -f web` |
| 查看资源占用 | `docker stats` |
| 更新代码后重新部署 | `git pull && docker compose up -d --build` |

### 数据持久化

PostgreSQL 数据存储在 Docker 命名卷 `postgres_data` 中，执行 `docker compose down` 不会丢失数据。仅当添加 `-v` 参数时才会清除卷。

上传文件（3D 模型、轮播图等）通过 `uploads/` 目录挂载到宿主机，可直接在 `./uploads` 下备份。

---

## 🖨 作品导出与落地
系统支持将数字作品转化为实物：
1. **OBJ/STL**：兼容主流 3D 建模软件。
2. **拓竹 3MF**：针对 Bambu Lab 打印机优化的格式，保留颜色信息，实现一键切片打印。

---

## 🏮 文化内涵
- **五彩面团**：色盘映射自传统非遗食材（红曲米、菠菜汁、老南瓜等），强调天然染色的文化属性。
- **大师点拨**：AI 提示词经过专门调优，以胶东民间艺术大师的口吻进行非遗知识传习。
