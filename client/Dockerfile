# ── 虾掌柜ERP 前端 Dockerfile（多阶段构建） ──

# Stage 1: 构建
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci && npm cache clean --force
COPY . .
RUN npm run build

# Stage 2: 部署
FROM nginx:1.27-alpine
# 复制构建产物
COPY --from=builder /app/dist /usr/share/nginx/html
# 复制静态资源
COPY --from=builder /app/public/logo.png /usr/share/nginx/html/
COPY --from=builder /app/public/logo-icon.png /usr/share/nginx/html/
COPY --from=builder /app/public/logo-title.png /usr/share/nginx/html/
COPY --from=builder /app/public/login-bg.png /usr/share/nginx/html/
# 复制 nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
