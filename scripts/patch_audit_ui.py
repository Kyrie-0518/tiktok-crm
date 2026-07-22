"""Patch AuditLogs.tsx: add model calls tab"""
with open(r'f:\tiktok-crm-dev\client\src\pages\AuditLogs.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Add model call states
old = "const [statusFilter, setStatusFilter] = useState('');"
new = old + """
  const [activeTab, setActiveTab] = useState('operations');
  const [modelCalls, setModelCalls] = useState<any[]>([]);
  const [mcLoading, setMcLoading] = useState(false);
  const [mcTotal, setMcTotal] = useState(0);
  const [mcPage, setMcPage] = useState(1);"""
code = code.replace(old, new)

# 2. Add fetchModelCalls after fetchLogs useEffect
old2 = "    fetchLogs();\n  }, [page, limit, search, statusFilter, dateRange]);"
new2 = old2 + """

  const fetchModelCalls = async () => {
    setMcLoading(true);
    try {
      const res = await api.get('/audit-logs/model-calls', { params: { page: mcPage, limit } });
      setModelCalls(res.data.data || []);
      setMcTotal(res.data.total || 0);
    } catch { setModelCalls([]); }
    finally { setMcLoading(false); }
  };

  useEffect(() => { if (activeTab === 'models') fetchModelCalls(); }, [mcPage, limit, activeTab]);"""
code = code.replace(old2, new2)

# 3. Add modelCallColumns and wrap in Tabs
old3 = """  return (
    <div style={{ background: "#f5f3f0", minHeight: "100%", padding: 24 }}>
      <div style={{ display: 'flex',"""
new3 = """  const modelCallColumns = [
    { title: '时间', dataIndex: 'created_at', width: 140, render: (v: string) => formatDateTime(v) },
    { title: '用户', dataIndex: 'username', width: 80 },
    { title: '模块', dataIndex: 'module', width: 80, render: (v: string) => <Tag>{v === 'owen' ? '欧文' : v === 'video' ? '视频' : v === 'diagnosis' ? '诊断' : v}</Tag> },
    { title: '模型', dataIndex: 'model_name', width: 100, ellipsis: true },
    { title: '输入', dataIndex: 'input_prompt', width: 200, ellipsis: true, render: (v: string) => <Text style={{ fontSize: 11 }}>{v?.slice(0, 80) || '-'}</Text> },
    { title: '输出', dataIndex: 'output_content', width: 250, ellipsis: true, render: (v: string) => <Text style={{ fontSize: 11 }}>{v?.slice(0, 100) || '-'}</Text> },
    { title: 'Token', key: 'tokens', width: 60, render: (_: any, r: any) => <Text style={{ fontSize: 11 }}>{r.tokens_in + r.tokens_out}</Text> },
    { title: '耗时', dataIndex: 'latency_ms', width: 60, render: (v: number) => v ? (v > 1000 ? (v/1000).toFixed(1)+'s' : v+'ms') : '-' },
    { title: 'IP', dataIndex: 'ip', width: 100 },
    { title: '状态', dataIndex: 'status', width: 60, render: (v: string) => <Tag color={v === 'success' ? 'green' : 'red'}>{v === 'success' ? '成功' : v}</Tag> },
  ];

  const tabItems = [
    { key: 'operations', label: '操作日志', children: (
    <div>
      <div style={{ display: 'flex',"""
code = code.replace(old3, new3)

# 4. Close tab
old4 = """    </div>
  );
}"""
new4 = """    </div>
    )},
    { key: 'models', label: <span><RobotOutlined /> 模型调用</span>, children: (
    <div style={{ paddingTop: 16 }}>
      <Table rowKey="id" columns={modelCallColumns} dataSource={modelCalls} loading={mcLoading}
        pagination={{ current: mcPage, total: mcTotal, pageSize: limit, onChange: setMcPage, showSizeChanger: false }}
        size="small" scroll={{ x: 1100 }} locale={{ emptyText: '暂无模型调用记录' }} />
    </div>
    )},
  ];

  return (
    <div style={{ background: '#f5f3f0', minHeight: '100%', padding: 24 }}>
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
    </div>
  );
}"""
code = code.replace(old4, new4)

with open(r'f:\tiktok-crm-dev\client\src\pages\AuditLogs.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
print('Patched AuditLogs.tsx')
