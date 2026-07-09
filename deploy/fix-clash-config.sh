#!/bin/bash
# ── 修复 Clash 配置：将节点 URI 包装为标准 YAML ──
set -e

echo "=== 修复 Clash 配置 ==="

# 1. 停止 clash
systemctl stop clash 2>/dev/null || true

# 2. 从订阅下载 + 解码节点
SUBSCRIBE_URL="https://ysbzc1.subscribe9.us/api/v1/client/subscribe?token=dc78ad77e2132e2fd0c3d1080efbb860"
curl -sLo /tmp/clash_raw "$SUBSCRIBE_URL"
NODES=$(base64 -d /tmp/clash_raw 2>/dev/null || cat /tmp/clash_raw)

# 3. 提取所有节点名称（从 URI 的 # 后面提取，URL 解码）
echo "$NODES" | while IFS= read -r line; do
  [ -z "$line" ] && continue
  NAME=$(echo "$line" | grep -oP '#.*$' | sed 's/^#//')
  # URL 解码
  NAME=$(python3 -c "import urllib.parse, sys; print(urllib.parse.unquote(sys.argv[1]))" "$NAME" 2>/dev/null || echo "$NAME")
  echo "$NAME"
done > /tmp/clash_node_names.txt

NODE_COUNT=$(wc -l < /tmp/clash_node_names.txt)
echo "  找到 $NODE_COUNT 个节点"

# 4. 生成标准 Clash 配置
cat > /etc/clash/config.yaml << YAML_HEADER
bind-address: "*"
port: 7890
socks-port: 7891
allow-lan: true
mode: rule
log-level: info
external-controller: 0.0.0.0:9090

proxies:
YAML_HEADER

# 添加节点（每行加 - 前缀）
echo "$NODES" | while IFS= read -r line; do
  [ -z "$line" ] && continue
  echo "  - $line" >> /etc/clash/config.yaml
done

# 添加代理组
cat >> /etc/clash/config.yaml << YAML_GROUP_HEAD
proxy-groups:
  - name: Proxy
    type: select
    proxies:
YAML_GROUP_HEAD

# 列出所有节点名
sed 's/^/      - /' /tmp/clash_node_names.txt >> /etc/clash/config.yaml

# 添加规则
cat >> /etc/clash/config.yaml << 'YAML_RULES'
  - name: TikTok
    type: select
    proxies:
      - Proxy
      - DIRECT
    url: http://www.gstatic.com/generate_204
    interval: 300

rules:
  - DOMAIN-SUFFIX,bytedance.com,TikTok
  - DOMAIN-SUFFIX,byted.org,TikTok
  - DOMAIN-SUFFIX,tiktok.com,TikTok
  - DOMAIN-SUFFIX,tiktokcdn.com,TikTok
  - DOMAIN-SUFFIX,tiktokv.com,TikTok
  - DOMAIN-SUFFIX,musical.ly,TikTok
  - DOMAIN-SUFFIX,muscdn.com,TikTok
  - DOMAIN-SUFFIX,ibytedtos.com,TikTok
  - DOMAIN-SUFFIX,byteoversea.com,TikTok
  - DOMAIN-KEYWORD,tiktok,TikTok
  - MATCH,Proxy
YAML_RULES

echo "  配置已生成，共 $NODE_COUNT 个节点"

# 5. 验证语法
# 尝试启动看是否能解析
timeout 3 /usr/local/bin/clash -d /etc/clash -t 2>&1 || true

# 6. 启动
systemctl start clash
sleep 2

# 7. 测试
echo ""
curl -x http://127.0.0.1:7890 -I https://business-api.tiktok.com/ --connect-timeout 5 && echo "✅ 代理工作正常！" || echo "⚠️ 代理测试失败，检查 journalctl -u clash -n 20"
