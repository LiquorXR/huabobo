# 花饽饽 DIY 数字非遗交互系统 - 项目文档

## 1. 项目概述
“花饽饽 DIY”是一个结合了传统非遗技艺（山东花饽饽）与现代 Web 技术的数字化交互系统。该项目旨在通过手势识别、3D 建模及 AI 辅助指导，让用户在数字世界中体验捏制花饽饽的乐趣，促进非物质文化遗产的传承与传播。

### 1.1 核心价值
- **文化传承**：将传统面塑技艺转化为数字化体验。
- **直观交互**：利用 MediaPipe 实现无接触式手势捏合操作。
- **AI 赋能**：集成 Gemini 大模型，提供大师级的实时技法点评。
- **闭环体验**：支持 3D 模型导出，适配 3D 打印，实现从虚拟到现实的转化。

---

## 2. 技术架构

### 2.1 前端技术栈
- **3D 引擎**：[Three.js](https://threejs.org/) - 负责场景渲染、面团模型展示及交互变形。
- **手势识别**：[MediaPipe Hands](https://google.github.io/mediapipe/solutions/hands.html) - 实现高精度的实时手势追踪与动作判定。
- **UI 框架**：[Tailwind CSS](https://tailwindcss.com/) - 响应式界面设计，适配 PC 与移动端。
- **图标库**：[Lucide](https://lucide.dev/) - 简洁的矢量图标支持。

### 2.2 后端与部署
- **基础设施**：[Cloudflare Pages](https://pages.cloudflare.com/) - 全球加速部署与 Serverless 函数支持。
- **API 路由**：Cloudflare Workers (Functions) - 处理与 AI 模型的安全通信。
- **AI 模型**：Google Gemini Pro - 提供非遗技法分析建议。

---

## 3. 核心功能模块分析

### 3.1 3D 交互系统 (`public/js/core/app.js`)
- **场景构建**：初始化 WebGL 渲染器、透视相机及环境光照。
- **面团管理**：支持多层级面团添加、删除及颜色切换。
- **模型导出**：集成 `OBJExporter` 和 `STLExporter`，支持导出 OBJ 或 STL 格式。

### 3.2 手势追踪模块 (`public/js/modules/hand-tracker.js`)
- **多端适配**：针对移动端和 PC 端分别优化摄像头流处理。
- **动作映射**：
  - `move` (食指引导)：控制面团在水平面移动。
  - `pinch` (捏合)：控制面团在垂直方向上的拉伸变形。
  - `fist` (握拳)：复位面团缩放比例。
  - `scaleUp/Down` (点赞/踩)：调节面团整体大小。
- **平滑算法**：使用历史缓存（EMA 逻辑）减少视觉抖动，提升交互顺滑度。

### 3.3 蒸制仿真模块 (`public/js/modules/steamer.js`)
- **动态模拟**：模拟面团在蒸制过程中的热胀冷缩及颜色微调。
- **视觉反馈**：通过着色器或材质属性变化呈现“熟化”效果。

### 3.4 大师传艺模块 (`functions/api/ask-master.js` & `public/js/modules/master.js`)
- **多模态分析**：基于当前作品的状态（面团数量、颜色、比例），通过 AI 生成具有非遗韵味的专业点评。
- **安全代理**：通过后端函数转发请求，保护 API Key 安全。

---

## 4. 目录结构说明

```text
├── functions/              # Cloudflare Pages 后端函数 (Serverless)
│   ├── api/                # API 接口目录
│   │   ├── ask-master.js   # AI 大师点拨接口
│   │   └── config.js       # 配置相关
│   └── _middleware.js      # 中间件处理
├── public/                 # 静态资源与前端代码
│   ├── css/                # 样式表
│   ├── fonts/              # 中文字体 (书法体)
│   ├── js/                 # 核心逻辑
│   │   ├── core/           # 系统入口与 3D 核心
│   │   ├── modules/        # 手势、AI、蒸制等功能模块
│   │   └── ui/             # 界面控制器
│   ├── lib/                # 第三方库本地化 (Three.js, MediaPipe)
│   └── index.html          # 项目主入口
├── package.json            # 项目依赖与脚本
└── wrangler.toml           # Cloudflare 部署配置 (可选)
```

---

## 5. 开发与部署指南

### 5.1 本地开发
1. 安装依赖：`npm install`
2. 启动开发服务器：`npm run dev` (需安装 wrangler)
3. 访问 `http://localhost:8788`

### 5.2 部署说明 (Cloudflare Pages)

1. **关联仓库**：将代码推送至 GitHub，在 Cloudflare Pages 后台创建新项目并关联。
2. **构建设置 (Build settings)**：
   - **Framework preset**: `None`
   - **Build command**: 留空 (不填写)
   - **Build output directory**: `public`  *(⚠️ 必须设置为 public，否则会报 404 错误)*
   - **Root directory**: `/` *(⚠️ 必须为根目录，以识别 functions 文件夹)*
3. **设置环境变量 (Environment variables)**：
   项目支持通过根目录下的 `wrangler.toml` 自动配置环境变量：
   - `GEMINI_MODEL`: 默认设置为 `gemini-3.1-flash-lite-preview`。
   - `GEMINI_API_KEY`: **必填**。出于安全考虑，建议在 Cloudflare Dashboard 的 "Settings" -> "Variables and Secrets" 中手动添加。
4. **本地开发环境变量**：
   本地开发时，`wrangler` 会优先读取 `wrangler.toml` 中的 `[vars]`。对于敏感信息，请在项目根目录创建 `.dev.vars` 文件（已加入 .gitignore），内容如下：
   ```text
   GEMINI_MODEL=gemini-3.1-flash-lite-preview
   GEMINI_API_KEY=你的密钥
   ```

---

## 6. 未来规划
- **纹理贴图**：增加真实的面塑纹理效果。
- **多人协作**：利用 WebRTC 实现多人在线共同捏制。
- **AR 模式**：通过 WebXR 将数字化花饽饽放置在现实厨房场景中。
