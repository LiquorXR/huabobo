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

### 部署步骤

1. **克隆代码**：
   ```bash
   git clone https://github.com/LiquorXR/huabobo.git
   cd huabobo
   ```

2. **环境变量配置**：
   - 复制一份生产环境所需的配置：
     ```bash
     cp .env.example .env
     ```
   - 打开 `.env` 并填写**必须**的生产环境变量，比如：
     ```ini
     GEMINI_API_KEY=你的真实秘钥
     JWT_SECRET=随机生成的长字符串
     GEMINI_MODEL=gemini-3.1-flash-lite-preview
     ```
   - **注意**：生产部署时建议使用 `DB_DIALECT=postgres`。当前 `docker-compose.yml` 会为 `web` 服务显式注入 PostgreSQL 连接参数。

3. **安全配置 (可选但建议)**：
   如果你希望使用自定义的数据库密码，请在 `docker-compose.yml` 文件中同步修改 `db` 容器的 `POSTGRES_PASSWORD` 以及 `web` 容器环境变量中的 `DB_PASS`。

4. **一键启动**：
   ```bash
   docker compose up -d --build
   ```
   *说明：Docker 会自动构建包含所有资源的镜像，同时拉取 PostgreSQL 并完成网络打通。*

5. **验证部署**：
   - 在浏览器中访问：`http://服务器IP:3179`。
   - 服务启动时，Sequelize 会由于配置了 `{ alter: true }` 自动把 PostgreSQL 的数据表结构同步完毕，并可以直接登录 Admin UI 添加资源。

### VPS 部署建议
- 建议只暴露 `web` 服务端口，不要把 PostgreSQL 的 `5432` 直接映射到公网。
- 建议在 VPS 上使用 Nginx/Caddy 反代 `3179`，并由反向代理统一处理 HTTPS。
- 容器内与宿主机统一监听 `3179`，便于环境一致性和排障。

### 停止与数据持久化
- 停止服务：`docker-compose down`
- （注意：数据库的数据被持久化在了 Docker 卷 `postgres_data` 中，即使执行 `down` 也不会丢失数据。若需彻底清除数据，可加上 `-v` 参数）。

---

## 🖨 作品导出与落地
系统支持将数字作品转化为实物：
1. **OBJ/STL**：兼容主流 3D 建模软件。
2. **拓竹 3MF**：针对 Bambu Lab 打印机优化的格式，保留颜色信息，实现一键切片打印。

---

## 🏮 文化内涵
- **五彩面团**：色盘映射自传统非遗食材（红曲米、菠菜汁、老南瓜等），强调天然染色的文化属性。
- **大师点拨**：AI 提示词经过专门调优，以胶东民间艺术大师的口吻进行非遗知识传习。
