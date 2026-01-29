FROM ghcr.io/puppeteer/puppeteer:latest

USER root
WORKDIR /app

# 复制依赖定义
COPY package*.json ./

# 安装生产环境依赖
RUN npm install --only=production

# 复制所有源代码
COPY . .

# 确保文件夹权限正确
RUN mkdir -p data && chown -R pptruser:pptruser /app

USER pptruser

EXPOSE 3000

CMD ["node", "server.js"]
