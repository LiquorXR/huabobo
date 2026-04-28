# 使用官方轻量级的 Node Alpine 镜像
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

ENV NODE_ENV=production
RUN npm ci --omit=dev && \
    npm cache clean --force

COPY . .

EXPOSE 3179

CMD ["npm", "start:prod"]
