# 使用官方轻量级的 Node Alpine 镜像
FROM node:20-alpine

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 生产环境稳定安装，依赖严格跟随 lockfile
ENV NODE_ENV=production
RUN npm ci --omit=dev && npm cache clean --force

# 复制其它项目文件和文件夹
COPY . .

# 对外暴露后端 3179 端口
EXPOSE 3179

# 启动 Node 服务器
CMD ["npm", "start"]
