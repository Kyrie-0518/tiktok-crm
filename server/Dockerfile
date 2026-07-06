# ── 虾掌柜ERP 后端 Dockerfile ──
FROM node:20-alpine

WORKDIR /app

# 安装编译 better-sqlite3 需要的工具 + wget + CA证书 + DNS工具
# ca-certificates: Node.js fetch 发 HTTPS 请求必需
# bind-tools: 提供 dig/nslookup 用于网络诊断
RUN apk add --no-cache python3 make g++ wget ca-certificates bind-tools

# 更新 CA 证书列表（确保 TLS 验证通过）
RUN update-ca-certificates

# 复制依赖文件
COPY package.json package-lock.json ./

# 安装依赖
RUN npm ci --omit=dev && npm cache clean --force

# 安装 tsx 用于直接运行 TypeScript
RUN npm install -g tsx

# 复制源码
COPY . .

# 创建数据目录
RUN mkdir -p data/uploads data/tmp

# 暴露端口
EXPOSE 3000

# 启动
CMD ["tsx", "src/index.ts"]
