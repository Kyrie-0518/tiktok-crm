#!/bin/bash
# ============================================
#  虾掌柜ERP 一键部署脚本
#  在服务器上执行: bash deploy.sh
# ============================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  虾掌柜ERP 服务器部署脚本${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# ── 1. 检查 Docker ──
echo -e "${YELLOW}[1/5] 检查 Docker 环境...${NC}"
if ! command -v docker &> /dev/null; then
    echo "Docker 未安装，正在安装..."
    curl -fsSL https://get.docker.com | bash
    systemctl enable docker
    systemctl start docker
    echo -e "${GREEN}Docker 安装完成${NC}"
else
    echo -e "${GREEN}Docker 已安装: $(docker --version)${NC}"
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "安装 docker compose 插件..."
    apt-get update -qq && apt-get install -y -qq docker-compose-plugin
fi
echo ""

# ── 2. 创建目录结构 ──
echo -e "${YELLOW}[2/5] 创建数据目录...${NC}"
mkdir -p server/data/uploads server/data/tmp
chmod -R 755 server/data
echo -e "${GREEN}数据目录创建完成${NC}"
echo ""

# ── 3. 配置环境变量 ──
echo -e "${YELLOW}[3/5] 配置环境变量...${NC}"

if [ ! -f server/.env ]; then
    # 生成随机 JWT Secret
    JWT_SECRET=$(openssl rand -base64 48 2>/dev/null || cat /dev/urandom | tr -dc 'a-zA-Z0-9' | head -c 64)

    cat > server/.env << EOF
# ── 服务端口 ──
PORT=3000

# ── 数据库路径 ──
DB_PATH=data/erp.db

# ── 文件上传目录（Docker内部路径） ──
UPLOAD_DIR=/app/data/uploads
EOF

    echo -e "${GREEN}.env 文件已生成${NC}"
else
    echo -e "${GREEN}.env 文件已存在，跳过${NC}"
fi
echo ""

# ── 4. 构建镜像（使用层缓存，仅重建变更层） ──
echo -e "${YELLOW}[4/5] 构建 Docker 镜像...${NC}"
docker compose build
echo -e "${GREEN}镜像构建完成${NC}"
echo ""

# ── 5. 启动服务 ──
echo -e "${YELLOW}[5/5] 启动服务...${NC}"
docker compose down --remove-orphans 2>/dev/null || true
docker compose up -d

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  部署完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "  前端: http://$(curl -s ifconfig.me 2>/dev/null || echo 'YOUR_SERVER_IP')"
echo "  后端: http://$(curl -s ifconfig.me 2>/dev/null || echo 'YOUR_SERVER_IP'):3000"
echo ""
echo "  常用命令:"
echo "    查看日志:  docker compose logs -f"
echo "    重启服务:  docker compose restart"
echo "    停止服务:  docker compose down"
echo "    查看状态:  docker compose ps"
echo ""
echo "  数据备份:"
echo "    数据库:   server/data/erp.db"
echo "    上传文件: server/data/uploads/"
echo "    备份命令:  tar -czf backup-\$(date +%Y%m%d).tar.gz server/data/"
echo ""

# ── 显示初始账号 ──
echo -e "${GREEN}  默认账号: admin / 首次登录需修改密码${NC}"
echo ""
