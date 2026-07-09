#!/bin/bash
# ── 在服务器上部署 Clash 代理 ──
set -e

CLASH_VER="v1.19.4"
SUBSCRIBE_URL="https://ysbzc1.subscribe9.us/api/v1/client/subscribe?token=dc78ad77e2132e2fd0c3d1080efbb860"

echo "[1/5] 下载 mihomo (clash meta)..."
mkdir -p /etc/clash
cd /tmp
wget -q "https://github.com/MetaCubeX/mihomo/releases/download/${CLASH_VER}/mihomo-linux-amd64-${CLASH_VER}.gz" -O clash.gz
gunzip -f clash.gz
mv clash /usr/local/bin/clash
chmod +x /usr/local/bin/clash
echo "  clash 已安装: $(clash -v 2>&1 || echo 'ok')"

echo "[2/5] 下载订阅..."
curl -sLo /tmp/clash_raw "$SUBSCRIBE_URL"
FILE_TYPE=$(file /tmp/clash_raw)

# 判断是否需要 base64 解码
if echo "$FILE_TYPE" | grep -qi "base64\|ASCII text\|data"; then
    echo "  订阅内容为 base64，解码中..."
    base64 -d /tmp/clash_raw > /etc/clash/config.yaml 2>/dev/null || cp /tmp/clash_raw /etc/clash/config.yaml
else
    cp /tmp/clash_raw /etc/clash/config.yaml
fi

# 确保 key 字段存在
head -5 /etc/clash/config.yaml
echo ""

# 修改配置：允许局域网访问
if grep -q "^allow-lan:" /etc/clash/config.yaml; then
    sed -i 's/^allow-lan:.*/allow-lan: true/' /etc/clash/config.yaml
fi
if grep -q "^external-controller:" /etc/clash/config.yaml; then
    sed -i 's/^external-controller:.*/external-controller: '0.0.0.0:9090'/' /etc/clash/config.yaml
fi
if grep -q "^mixed-port:" /etc/clash/config.yaml; then
    sed -i 's/^mixed-port:.*/mixed-port: 7890/' /etc/clash/config.yaml
fi
# 确保 bind-address 为 0.0.0.0
if ! grep -q "bind-address" /etc/clash/config.yaml; then
    sed -i '1i bind-address: "*"' /etc/clash/config.yaml
fi

echo "[3/5] 创建 systemd 服务..."
cat > /etc/systemd/system/clash.service << 'EOF'
[Unit]
Description=Clash Proxy
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/local/bin/clash -d /etc/clash
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload

echo "[4/5] 启动 clash..."
systemctl restart clash
systemctl enable clash
sleep 3

echo "[5/5] 验证代理..."
curl -x http://127.0.0.1:7890 -I https://business-api.tiktok.com/ --connect-timeout 5 && echo "✅ 代理工作正常" || echo "⚠️ 代理测试失败，请检查 /etc/clash/config.yaml"

echo ""
echo "========================="
echo "  代理已在 7890 端口运行"
echo "========================="
echo "  http://127.0.0.1:7890"
echo ""
echo "  请执行下一步：修改 docker-compose.yml 添加 HTTPS_PROXY"
