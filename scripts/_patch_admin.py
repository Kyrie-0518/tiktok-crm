import sys
with open(r'f:\tiktok-crm-dev\client\src\pages\AdminLayout.tsx','r',encoding='utf-8') as f:
    c = f.read()

# Add icon  
c=c.replace("AuditOutlined, ApiOutlined, RobotOutlined,",
            "AuditOutlined, ApiOutlined, RobotOutlined, SafetyCertificateOutlined,")

# Add import
c=c.replace("import BotManagement from './BotManagement';",
            "import BotManagement from './BotManagement';\nimport AdminModeration from './AdminModeration';")

# Add menu item
c=c.replace("{ key: '/admin/audit', icon: <AuditOutlined />, label: '操作日志' },",
            "{ key: '/admin/audit', icon: <AuditOutlined />, label: '操作日志' },\n  { key: '/admin/moderation', icon: <SafetyCertificateOutlined />, label: '违禁词管理' },")

# Add component mapping
c=c.replace("'/admin/audit': AuditLogs,",
            "'/admin/audit': AuditLogs,\n  '/admin/moderation': AdminModeration,")

with open(r'f:\tiktok-crm-dev\client\src\pages\AdminLayout.tsx','w',encoding='utf-8') as f:
    f.write(c)
print('OK')
