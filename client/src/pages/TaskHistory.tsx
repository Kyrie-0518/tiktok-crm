import React, { useEffect, useState } from 'react';
import { Card, Table, Tag, Typography, Button, Spin, Empty, message, Collapse, Drawer } from 'antd';
import { ReloadOutlined, EyeOutlined, HistoryOutlined, CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import PageHeader from '../components/design-system/PageHeader';
import api from '../api';

const { Text, Paragraph } = Typography;

export default function TaskHistory() {
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<any[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<any>(null);

  const fetch = async () => {
    try { setLoading(true); const r = await api.get('/ai-engine/tasks', { params: { limit: 50 } }); setTasks(r.data?.tasks || r.data?.list || []); } catch { message.error('加载失败'); } finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, []);

  const loadDetail = async (taskId: string) => {
    try { const r = await api.get(`/ai-engine/tasks/${taskId}`); setDetail(r.data); setDetailOpen(true); } catch { message.error('加载详情失败'); }
  };

  const columns = [
    { title: '时间', dataIndex: 'created_at', width: 140, render: (v: string) => <Text style={{ fontSize: 12, color: '#64748B' }}>{v?.slice(0, 16)?.replace('T', ' ')}</Text> },
    { title: '商品', dataIndex: 'product_name', width: 120, ellipsis: true, render: (v: string) => v || '—' },
    { title: 'Prompt', dataIndex: 'user_prompt', ellipsis: true, render: (v: string) => <Text style={{ fontSize: 12, color: '#64748B' }}>{v?.slice(0, 50) || '—'}</Text> },
    {
      title: '状态', dataIndex: 'status', width: 90,
      render: (s: string) => {
        const m: Record<string, { c: string; l: string }> = { completed: { c: '#22C55E', l: '完成' }, failed: { c: '#EF4444', l: '失败' }, running: { c: '#3B82F6', l: '运行中' }, retrying: { c: '#F59E0B', l: '重试中' } };
        const t = m[s] || { c: '#94A3B8', l: s };
        return <Tag style={{ borderRadius: 6, border: 'none', background: `${t.c}18`, color: t.c, fontSize: 11 }}>{t.l}</Tag>;
      },
    },
    { title: '模型', dataIndex: 'model', width: 100, render: (v: string) => <Tag style={{ fontSize: 11 }}>{v || '—'}</Tag> },
    { title: '质量分', dataIndex: 'quality_score', width: 70, align: 'right' as const, render: (v: number) => v ? <span style={{ fontWeight: 600, color: v >= 85 ? '#22C55E' : '#EF4444' }}>{v}</span> : '—' },
    {
      title: '操作', width: 70,
      render: (_: any, r: any) => <Button size="small" type="link" icon={<EyeOutlined />} onClick={() => loadDetail(r.task_id)}>查看</Button>,
    },
  ];

  const steps = detail?.steps || [];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <PageHeader title="历史任务" description="查看所有 AI 视频生成任务的执行记录" icon={<HistoryOutlined />} />
        <Button icon={<ReloadOutlined />} onClick={fetch} loading={loading}>刷新</Button>
      </div>

      <Card style={{ borderRadius: 10 }} bodyStyle={{ padding: 0 }}>
        <Spin spinning={loading}>
          <Table rowKey="task_id" columns={columns} dataSource={tasks} size="small" pagination={{ pageSize: 20, size: 'small' }}
            locale={{ emptyText: <Empty description="暂无历史任务" /> }} />
        </Spin>
      </Card>

      {/* 详情 Drawer */}
      <Drawer title={<span>任务详情 <code style={{ fontSize: 11, color: '#64748B', fontWeight: 400 }}>{detail?.task_id}</code></span>}
        width={640} open={detailOpen} onClose={() => setDetailOpen(false)} destroyOnClose>
        {detail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* 基本信息 */}
            <Card size="small" title="基本信息" style={{ borderRadius: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: 12 }}>
                <div><Text style={{ color: '#94A3B8' }}>商品</Text><div>{detail.product_name || '—'}</div></div>
                <div><Text style={{ color: '#94A3B8' }}>模型</Text><div>{detail.model || '—'}</div></div>
                <div><Text style={{ color: '#94A3B8' }}>状态</Text><div>{detail.status}</div></div>
                <div><Text style={{ color: '#94A3B8' }}>质量分</Text><div style={{ fontWeight: 600, color: detail.quality_score >= 85 ? '#22C55E' : '#EF4444' }}>{detail.quality_score || '—'}</div></div>
                <div><Text style={{ color: '#94A3B8' }}>总耗时</Text><div>{detail.total_time_ms ? `${(detail.total_time_ms / 1000).toFixed(1)}s` : '—'}</div></div>
                <div><Text style={{ color: '#94A3B8' }}>Token</Text><div>{detail.total_tokens?.toLocaleString() || '—'}</div></div>
              </div>
            </Card>

            {/* 用户 Prompt */}
            <Card size="small" title="用户 Prompt" style={{ borderRadius: 10 }}>
              <Paragraph style={{ fontSize: 12, whiteSpace: 'pre-wrap', margin: 0 }}>{detail.user_prompt || '—'}</Paragraph>
            </Card>

            {/* 最终 Prompt */}
            <Card size="small" title="最终 Prompt（经 Engine 优化后）" style={{ borderRadius: 10 }}>
              <Paragraph code copyable style={{ fontSize: 12, whiteSpace: 'pre-wrap', margin: 0, background: '#F8FAFC', padding: 12, borderRadius: 8 }}>{detail.final_prompt || '—'}</Paragraph>
            </Card>

            {/* Pipeline Steps */}
            <Card size="small" title={`Pipeline 步骤（${steps.length}）`} style={{ borderRadius: 10 }}>
              {steps.length === 0 && <Empty description="无步骤记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {steps.map((s: any, i: number) => {
                  const AGENT_LABELS: Record<string, { color: string; title: string }> = {
                    vision: { color: '#6E56FF', title: '① 商品理解' },
                    strategy: { color: '#3B82F6', title: '② 创意策略' },
                    director: { color: '#8B5CF6', title: '③ AI 导演' },
                    prompt_engine: { color: '#F59E0B', title: '④ Prompt 引擎' },
                    optimizer: { color: '#EF4444', title: '⑤ Prompt 优化' },
                    adapter: { color: '#22C55E', title: '⑥ 模型适配' },
                    quality: { color: '#EC4899', title: '⑦ 质量评估' },
                  };
                  const meta = AGENT_LABELS[s.agent] || { color: '#94A3B8', title: s.agent };
                  const icon = s.status === 'completed' ? <CheckCircleOutlined style={{ color: '#22C55E' }} /> :
                    s.status === 'failed' ? <CloseCircleOutlined style={{ color: '#EF4444' }} /> :
                    <ClockCircleOutlined style={{ color: '#94A3B8' }} />;
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 8, background: '#F8FAFC', borderLeft: `3px solid ${meta.color}` }}>
                      {icon}
                      <div style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: 600 }}>{meta.title}</Text>
                        <div style={{ display: 'flex', gap: 12, marginTop: 2 }}>
                          {s.duration_ms ? <Text style={{ fontSize: 11, color: '#94A3B8' }}>{(s.duration_ms / 1000).toFixed(1)}s</Text> : null}
                          {s.tokens > 0 ? <Text style={{ fontSize: 11, color: '#94A3B8' }}>{s.tokens} Token</Text> : null}
                        </div>
                        {s.error && <div style={{ marginTop: 6, padding: '6px 8px', borderRadius: 6, background: '#FEF2F2', fontSize: 11, color: '#DC2626' }}>{s.error}</div>}
                        {s.output && (
                          <Collapse ghost size="small" style={{ marginTop: 4 }} items={[{
                            key: 'o', label: <span style={{ fontSize: 11 }}>查看输出</span>,
                            children: <pre style={{ fontSize: 10, maxHeight: 150, overflow: 'auto', background: '#F1F5F9', padding: 8, borderRadius: 6, margin: 0 }}>{JSON.stringify(s.output, null, 2)}</pre>,
                          }]} />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        )}
      </Drawer>
    </div>
  );
}
