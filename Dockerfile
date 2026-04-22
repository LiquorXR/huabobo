# 使用官方轻量级的 Node Alpine 镜像
FROM node:20-alpine

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装编译原生模块所需的依赖 (如 bcrypt)
RUN apk add --no-cache python3 make g++
RUN npm ci --only=production

# 复制其它项目文件和文件夹
COPY . .

# 如果项目有任何初始的构建步骤 (例如 manifest 构建) 在此时执行
RUN npm run build

# 对外暴露后端 3179 端口
EXPOSE 3179

# 启动 Node 服务器
CMD ["npm", "start"]
