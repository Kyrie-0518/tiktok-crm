#!/bin/bash
# ── 用 Python 解析订阅 URI 并生成标准 Clash 配置 ──
set -e

echo "=== 修复 Clash 配置 ==="

# 1. 停止 clash
systemctl stop clash 2>/dev/null || true

# 2. 运行解析脚本
python3 /opt/tiktok-crm/deploy/parse_clash_nodes.py

# 3. 验证语法
timeout 5 /usr/local/bin/clash -d /etc/clash -t 2>&1 || true

# 4. 启动
systemctl start clash
sleep 2

# 5. 测试
echo ""
curl -x http://127.0.0.1:7890 -I https://business-api.tiktok.com/ --connect-timeout 5 && echo "✅ 代理工作正常！" || echo "⚠️ 代理测试失败，检查 journalctl -u clash -n 20"
