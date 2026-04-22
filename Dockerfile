# 使用官方轻量级的 Node Alpine 镜像
FROM node:20-alpine

# 设置工作目录
WORKDIR /app

# 设置国内镜像源加速 (可选，若在国外服务器可注释掉)
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 设置 NPM 国内镜像源并安装依赖
# 注意：已将 bcrypt 替换为 bcryptjs，无需安装 python3/make/g++ 编译环境
# 使用 npm install 而非 npm ci 以处理 package-lock 不同步的问题
RUN npm config set registry https://registry.npmmirror.com && \
    npm install --omit=dev

# 复制其它项目文件和文件夹
COPY . .

# 执行 manifest 构建
RUN npm run build

# 对外暴露后端 3179 端口
EXPOSE 3179

# 启动 Node 服务器
CMD ["npm", "start"]
