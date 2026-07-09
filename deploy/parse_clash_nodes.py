#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把 ss:// / vless:// 订阅 URI 转换成标准 Clash Meta YAML 配置"""
import base64
import urllib.parse
import urllib.request
import re
import sys

def url_decode(s):
    return urllib.parse.unquote(s)

def parse_ss(uri):
    # ss://base64(method:password@server:port) 或 ss://base64(method:password)@server:port#name
    m = re.match(r'^ss://([^@]+)@([^:]+):(\d+)(?:#(.*))?$', uri)
    if m:
        userinfo_b64 = m.group(1)
        server = m.group(2)
        port = int(m.group(3))
        name = url_decode(m.group(4) or f'{server}:{port}')
        # userinfo 可能是 base64(method:password) 或 base64(method:password@server:port)
        try:
            userinfo = base64.b64decode(userinfo_b64).decode('utf-8')
            # 去掉可能的 server:port 后缀
            if '@' in userinfo:
                userinfo = userinfo.split('@')[0]
            if ':' in userinfo:
                method, password = userinfo.split(':', 1)
            else:
                method, password = 'aes-256-gcm', userinfo
        except Exception:
            method, password = 'aes-256-gcm', url_decode(userinfo_b64)
        return {
            'name': name,
            'type': 'ss',
            'server': server,
            'port': port,
            'cipher': method,
            'password': password,
        }
    return None

def parse_vless(uri):
    # vless://uuid@server:port?params#name
    m = re.match(r'^vless://([^@]+)@([^:]+):(\d+)\?([^#]+)(?:#(.*))?$', uri)
    if not m:
        return None
    uuid = m.group(1)
    server = m.group(2)
    port = int(m.group(3))
    query = urllib.parse.parse_qs(m.group(4))
    name = url_decode(m.group(5) or f'{server}:{port}')
    
    proxy = {
        'name': name,
        'type': 'vless',
        'server': server,
        'port': port,
        'uuid': uuid,
        'network': query.get('type', ['tcp'])[0],
        'tls': query.get('security', ['none'])[0] in ('tls', 'reality'),
        'client-fingerprint': query.get('fp', ['chrome'])[0],
        'servername': query.get('sni', [''])[0],
        'skip-cert-verify': query.get('insecure', ['0'])[0] == '1',
    }
    
    flow = query.get('flow', [''])[0]
    if flow:
        proxy['flow'] = flow
    
    if query.get('security', ['none'])[0] == 'reality':
        pbk = query.get('pbk', [''])[0]
        sid = query.get('sid', [''])[0]
        if pbk:
            proxy['reality-opts'] = {}
            proxy['reality-opts']['public-key'] = pbk
            if sid:
                proxy['reality-opts']['short-id'] = sid
    
    return proxy

def uri_to_clash(uri):
    uri = uri.strip()
    if not uri:
        return None
    if uri.startswith('ss://'):
        return parse_ss(uri)
    elif uri.startswith('vless://'):
        return parse_vless(uri)
    return None

def generate_config(nodes):
    proxies = [n for n in nodes if n]
    names = [p['name'] for p in proxies]
    
    lines = []
    lines.append('bind-address: "*"')
    lines.append('port: 7890')
    lines.append('socks-port: 7891')
    lines.append('allow-lan: true')
    lines.append('mode: rule')
    lines.append('log-level: info')
    lines.append('external-controller: 0.0.0.0:9090')
    lines.append('')
    lines.append('proxies:')
    
    for p in proxies:
        lines.append(f'  - name: "{p["name"]}"')
        lines.append(f'    type: {p["type"]}')
        lines.append(f'    server: {p["server"]}')
        lines.append(f'    port: {p["port"]}')
        if p['type'] == 'ss':
            lines.append(f'    cipher: {p["cipher"]}')
            lines.append(f'    password: "{p["password"]}"')
        elif p['type'] == 'vless':
            lines.append(f'    uuid: {p["uuid"]}')
            lines.append(f'    network: {p["network"]}')
            lines.append(f'    tls: {str(p["tls"]).lower()}')
            lines.append(f'    client-fingerprint: {p["client-fingerprint"]}')
            if p.get('servername'):
                lines.append(f'    servername: {p["servername"]}')
            if p.get('flow'):
                lines.append(f'    flow: {p["flow"]}')
            if p.get('skip-cert-verify'):
                lines.append('    skip-cert-verify: true')
            if 'reality-opts' in p:
                lines.append('    reality-opts:')
                for k, v in p['reality-opts'].items():
                    lines.append(f'      {k}: {v}')
        lines.append('')
    
    lines.append('proxy-groups:')
    lines.append('  - name: Proxy')
    lines.append('    type: url-test')
    lines.append('    proxies:')
    for n in names:
        lines.append(f'      - "{n}"')
    lines.append('    url: http://www.gstatic.com/generate_204')
    lines.append('    interval: 300')
    lines.append('    tolerance: 150')
    lines.append('')
    lines.append('  - name: TikTok')
    lines.append('    type: url-test')
    lines.append('    proxies:')
    for n in names:
        lines.append(f'      - "{n}"')
    lines.append('    url: http://www.gstatic.com/generate_204')
    lines.append('    interval: 300')
    lines.append('')
    lines.append('rules:')
    lines.append('  - DOMAIN-SUFFIX,bytedance.com,TikTok')
    lines.append('  - DOMAIN-SUFFIX,byted.org,TikTok')
    lines.append('  - DOMAIN-SUFFIX,tiktok.com,TikTok')
    lines.append('  - DOMAIN-SUFFIX,tiktokcdn.com,TikTok')
    lines.append('  - DOMAIN-SUFFIX,tiktokv.com,TikTok')
    lines.append('  - DOMAIN-SUFFIX,musical.ly,TikTok')
    lines.append('  - DOMAIN-SUFFIX,muscdn.com,TikTok')
    lines.append('  - DOMAIN-SUFFIX,ibytedtos.com,TikTok')
    lines.append('  - DOMAIN-SUFFIX,byteoversea.com,TikTok')
    lines.append('  - DOMAIN-KEYWORD,tiktok,TikTok')
    lines.append('  - MATCH,DIRECT')
    
    return '\n'.join(lines)

def main():
    subscribe_url = "https://ysbzc1.subscribe9.us/api/v1/client/subscribe?token=dc78ad77e2132e2fd0c3d1080efbb860"
    try:
        with urllib.request.urlopen(subscribe_url, timeout=30) as resp:
            raw = base64.b64decode(resp.read().decode('utf-8')).decode('utf-8')
    except Exception as e:
        print(f"下载订阅失败: {e}")
        sys.exit(1)
    
    uris = [line.strip() for line in raw.splitlines() if line.strip()]
    nodes = [uri_to_clash(uri) for uri in uris]
    nodes = [n for n in nodes if n]
    
    if not nodes:
        print("没有解析到任何节点")
        sys.exit(1)
    
    print(f"解析到 {len(nodes)} 个节点")
    config = generate_config(nodes)
    
    with open('/etc/clash/config.yaml', 'w', encoding='utf-8') as f:
        f.write(config)
    
    print("配置已写入 /etc/clash/config.yaml")

if __name__ == '__main__':
    main()
