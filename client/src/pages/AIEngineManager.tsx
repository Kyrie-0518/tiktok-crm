import React, { useEffect, useState } from 'react';
import { Card, Tag, Spin, Typography, Table, Empty, Collapse, Button, message } from 'antd';
import {
  ApiOutlined, CheckCircleOutlined, CloseCircleOutlined,
  ClockCircleOutlined, ThunderboltOutlined, SettingOutlined,
  SearchOutlined, EyeOutlined, ReloadOutlined,
} from '@ant-design/icons';
import PageHeader from '../components/design-system/PageHeader';
import api from '../api';

const { Text, Paragraph } = Typography;

const AGENT_META: Record<string, { icon: React.ReactNode; title: string; desc: string; color: string }> = {
  vision:   { icon: <SearchOutlined />,     title: '① 商品理解',   desc: '分析商品图片与描述，输出结构化属性与卖点',   color: '#6E56FF' },
  strategy: { icon: <ThunderboltOutlined />, title: '② 创意策略',   desc: '基于商品与用户需求，制定视频风格与节奏',       color: '#3B82F6' },
  director: { icon: <EyeOutlined />,         title: '③ AI 导演',    desc: '生成分镜脚本，规划镜头时序与转场',              color: '#8B5CF6' },
  prompt_engine: { icon: <SettingOutlined />,title: '④ Prompt 引擎',desc: '将分镜转化为模型可用的 Prompt',                   color: '#F59E0B' },
  optimizer:{ icon: <ApiOutlined />,         title: '⑤ Prompt 优化',desc: '根据不同模型偏好微调 Prompt 表达',                color: '#EF4444' },
  adapter:  { icon: <ApiOutlined />,         title: '⑥ 模型适配',   desc: '统一所有模型的生成参数格式',                      color: '#22C55E' },
  quality:  { icon: <CheckCircleOutlined />, title: '⑦ 质量评估',   desc: '评估生成结果，低于 85 分自动触发重试',            color: '#EC4899' },
};

export default function AIEngineManager() {
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<any[]>([]);
  const [selectedTask, setSelectedTask] = useState<any>(null);

  const fetchTasks = async () => {
    try { setLoading(true); const r = await api.get('/ai-engine/tasks', { params: { limit: 30 } }); setTasks(r.data?.tasks || r.data?.list || []); } catch { message.error('加载失败'); } finally { setLoading(false); }
  };

  useEffect(() => { fetchTasks(); }, []);

  const loadDetail = async (taskId: string) => {
    try { const r = await api.get(`/ai-engine/tasks/${taskId}`); setSelectedTask(r.data); } catch { message.error('加载详情失败'); }
  };

  const columns = [
    { title: '任务ID', dataIndex: 'task_id', width: 160, render: (v: string) => <Text copyable style={{ fontSize: 12, fontFamily: 'monospace' }}>{v?.slice(0, 12)}…</Text> },
    { title: '商品', dataIndex: 'product_name', width: 120, ellipsis: true, render: (v: string) => v || '—' },
    { title: 'Prompt', dataIndex: 'user_prompt', ellipsis: true, render: (v: string) => <span style={{ fontSize: 12, color: '#64748B' }}>{v?.slice(0, 40) || '—'}</span> },
    { title: '模型', dataIndex: 'model', width: 110, render: (v: string) => <Tag style={{ fontSize: 11 }}>{v || '—'}</Tag> },
    {
      title: '状态', dataIndex: 'status', width: 90,
      render: (s: string) => {
        const m: Record<string, { c: string; l: string }> = { completed: { c: '#22C55E', l: '完成' }, failed: { c: '#EF4444', l: '失败' }, running: { c: '#3B82F6', l: '运行中' }, pending: { c: '#94A3B8', l: '排队' }, retrying: { c: '#F59E0B', l: '重试中' } };
        const t = m[s] || { c: '#94A3B8', l: s };
        return <Tag style={{ borderRadius: 6, border: 'none', background: `${t.c}18`, color: t.c, fontSize: 11 }}>{t.l}</Tag>;
      },
    },
    { title: '质量分', dataIndex: 'quality_score', width: 70, align: 'right' as const, render: (v: number) => v ? <span style={{ fontWeight: 600, color: v >= 85 ? '#22C55E' : '#EF4444' }}>{v}</span> : '—' },
    { title: 'Token', dataIndex: 'total_tokens', width: 70, align: 'right' as const, render: (v: number) => v ? <span style={{ fontSize: 12 }}>{v.toLocaleString()}</span> : '—' },
    {
      title: '操作', width: 70,
      render: (_: any, r: any) => <Button size="small" type="link" icon={<EyeOutlined />} onClick={() => loadDetail(r.task_id)}>详情</Button>,
    },
  ];

  const steps = selectedTask?.steps || [];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <PageHeader title="AI Engine" description="管理 AI 视频生成引擎的 7 个 Agent 与执行日志" icon={<ThunderboltOutlined />} />
        <Button icon={<ReloadOutlined />} onClick={fetchTasks} loading={loading}>刷新</Button>
      </div>

      {/* Agent 总览 7 卡 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 10, marginBottom: 20 }}>
        {Object.entries(AGENT_META).map(([key, meta]) => (
          <Card key={key} size="small" style={{ borderRadius: 10 }} bodyStyle={{ padding: '12px 14px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 4 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `${meta.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: meta.color, fontSize: 16 }}>
                {meta.icon}
              </div>
              <Text style={{ fontSize: 11, fontWeight: 700, color: '#1E293B' }}>{meta.title}</Text>
              <Text style={{ fontSize: 10, color: '#94A3B8', lineHeight: 1.4 }}>{meta.desc}</Text>
            </div>
          </Card>
        ))}
      </div>

      {/* 任务列表 */}
      <Card title={`执行记录（${tasks.length} 条）`} style={{ borderRadius: 10, marginBottom: 20 }} bodyStyle={{ padding: 0 }}>
        <Spin spinning={loading}>
          <Table rowKey="task_id" columns={columns} dataSource={tasks} size="small" pagination={{ pageSize: 15, size: 'small' }}
            locale={{ emptyText: <Empty description="暂无执行记录" /> }} />
        </Spin>
      </Card>

      {/* 任务详情 Drawer */}
      {selectedTask && (
        <Card
          title={<span>任务详情 <code style={{ fontSize: 11, color: '#64748B', fontWeight: 400 }}>{selectedTask.task_id}</code></span>}
          extra={<Button size="small" onClick={() => setSelectedTask(null)}>关闭</Button>}
          style={{ borderRadius: 10, marginBottom: 20 }}
        >
          <div style={{ display: 'flex', gap: 20 }}>
            <div style={{ flex: 1 }}>
              <Text strong style={{ display: 'block', marginBottom: 12 }}>Pipeline 步骤</Text>
              {steps.length === 0 && <Empty description="无步骤记录" />}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {steps.map((s: any, i: number) => {
                  const meta = AGENT_META[s.agent] || { icon: <SettingOutlined />, color: '#94A3B8', title: s.agent };
                  const icon = s.status === 'completed' ? <CheckCircleOutlined style={{ color: '#22C55E' }} /> :
                    s.status === 'failed' ? <CloseCircleOutlined style={{ color: '#EF4444' }} /> :
                    s.status === 'running' ? <ClockCircleOutlined style={{ color: '#3B82F6' }} /> :
                    <ClockCircleOutlined style={{ color: '#94A3B8' }} />;
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 12px', borderRadius: 8, background: '#F8FAFC', borderLeft: `3px solid ${meta.color}` }}>
                      {icon}
                      <div style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: 600 }}>{meta.title}</Text>
                        {s.duration_ms && <Text style={{ marginLeft: 8, fontSize: 11, color: '#94A3B8' }}>{(s.duration_ms / 1000).toFixed(1)}s</Text>}
                        {s.tokens > 0 && <Text style={{ marginLeft: 8, fontSize: 11, color: '#94A3B8' }}>{s.tokens} Token</Text>}
                        {s.error && <div style={{ marginTop: 4, padding: '6px 8px', borderRadius: 6, background: '#FEF2F2', fontSize: 11, color: '#DC2626' }}>{s.error}</div>}
                        {s.output && <Collapse ghost size="small" items={[{ key: 'o', label: <span style={{ fontSize: 11 }}>查看输出</span>, children: <pre style={{ fontSize: 10, maxHeight: 200, overflow: 'auto', background: '#F1F5F9', padding: 8, borderRadius: 6 }}>{JSON.stringify(s.output, null, 2)}</pre> }]} />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <Text strong style={{ display: 'block', marginBottom: 12 }}>最终 Prompt</Text>
              <div style={{ background: '#F8FAFC', padding: 14, borderRadius: 10, border: '1px solid #EAECF0' }}>
                <Paragraph code copyable style={{ fontSize: 12, whiteSpace: 'pre-wrap', margin: 0 }}>
                  {selectedTask.final_prompt || '—'}
                </Paragraph>
              </div>
              {selectedTask.quality_score > 0 && (
                <div style={{ marginTop: 16 }}>
                  <Text strong style={{ display: 'block', marginBottom: 8 }}>质量评估</Text>
                  <div style={{ fontSize: 28, fontWeight: 800, color: selectedTask.quality_score >= 85 ? '#22C55E' : '#EF4444' }}>
                    {selectedTask.quality_score}
                    <span style={{ fontSize: 14, fontWeight: 400, color: '#94A3B8' }}> / 100</span>
                  </div>
                </div>
              )}
              <div style={{ marginTop: 16, display: 'flex', gap: 16 }}>
                <div><Text style={{ fontSize: 11, color: '#94A3B8' }}>总耗时</Text><div><Text strong>{(selectedTask.total_time_ms / 1000).toFixed(1)}s</Text></div></div>
                <div><Text style={{ fontSize: 11, color: '#94A3B8' }}>总 Token</Text><div><Text strong>{selectedTask.total_tokens?.toLocaleString()}</Text></div></div>
                <div><Text style={{ fontSize: 11, color: '#94A3B8' }}>模型</Text><div><Text strong>{selectedTask.model}</Text></div></div>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
