import React, { useState, useEffect } from 'react';
import { Card, Button, Typography, Space, Descriptions, Tag, Progress, Row, Col, Select, message, Spin, List, Empty, Divider, Alert } from 'antd';
import { CheckCircleFilled, CloseCircleFilled, ThunderboltOutlined, ReloadOutlined, FilePdfOutlined, FileExcelOutlined, ShareAltOutlined, BarChartOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../../api';

const { Text, Title, Paragraph } = Typography;

const DS = { bg: '#f5f3f0', cardBg: '#FFFFFF', cardBorder: '#e8e5e0', primary: '#2563eb', text: '#1A1A2E', textSecondary: '#6B7280', success: '#10B981', error: '#EF4444', warning: '#F59E0B', radius: 12 };

export default function ShopDiagnosis() {
  const navigate = useNavigate();
  const [shops, setShops] = useState<any[]>([]);
  const [selectedShop, setSelectedShop] = useState<string>('');
  const [diagnosing, setDiagnosing] = useState(false);
  const [diagnoses, setDiagnoses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/shops').then(r => setShops(r.data || [])).catch(() => {}).finally(() => setLoading(false));
    api.get('/growth-center/history', { params: { limit: 2 } })
      .then(r => { const rows = r.data?.rows?.filter((d: any) => d.status === 'completed') || []; setDiagnoses(rows); })
      .catch(() => {});
  }, []);

  const startDiagnosis = async () => {
    if (!selectedShop) return message.warning('请选择店铺');
    setDiagnosing(true);
    try {
      const shop = shops.find(s => s.shop_cipher === selectedShop) || {};
      // 异步模式：立即返回 taskId，然后轮询
      const startRes = await api.post('/growth-center/diagnose', {
        shop_cipher: selectedShop, shop_name: shop.shop_name || '', days: 30,
      }, { timeout: 180000 });
      message.success('诊断完成！');
      api.get('/growth-center/history', { params: { limit: 2 } })
        .then(r => setDiagnoses(r.data?.rows?.filter((d: any) => d.status === 'completed') || []))
        .catch(() => {});
    } catch (e: any) {
      message.error(e.response?.data?.error || '诊断失败');
    } finally { setDiagnosing(false); }
  };

  const latestDiagnosis = diagnoses[0];

  return (
    <div style={{ padding: 24, background: DS.bg, minHeight: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: `linear-gradient(135deg, #8B5CF6, #A78BFA)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 20 }}><BarChartOutlined /></div>
        <div style={{ flex: 1 }}>
          <Title level={4} style={{ margin: 0, fontSize: 20, fontWeight: 700, color: DS.text }}>店铺诊断</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>AI 自动分析店铺经营状况，输出优化方案</Text>
        </div>
        <Space>
          <Select placeholder="选择店铺" value={selectedShop} onChange={setSelectedShop} style={{ width: 200 }}
            options={shops.map((s: any) => ({ value: s.shop_cipher || s.id, label: s.name || s.shop_name || s.shop_cipher || `店铺#${s.id}` }))} loading={loading} />
          <Button type="primary" icon={<ThunderboltOutlined />} onClick={startDiagnosis} loading={diagnosing} style={{ borderRadius: 8, background: '#8B5CF6', borderColor: '#8B5CF6' }}>
            开始诊断
          </Button>
          <Button icon={<ReloadOutlined />} onClick={() => navigate('/growth-center/history')} style={{ borderRadius: 8 }}>诊断记录</Button>
        </Space>
      </div>

      {!latestDiagnosis ? (
        <Card style={{ borderRadius: DS.radius, border: `1px solid ${DS.cardBorder}`, textAlign: 'center', padding: 60 }}>
          <Empty description="暂无诊断记录" image={Empty.PRESENTED_IMAGE_SIMPLE}>
            <Text type="secondary">选择一个店铺，点击"开始诊断"即可自动生成分析报告</Text>
          </Empty>
        </Card>
      ) : (
        <Row gutter={16}>
          {/* 左侧主内容 */}
          <Col span={16}>
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              {/* 健康评分卡片 */}
              <Card style={{ borderRadius: DS.radius, border: `1px solid ${DS.cardBorder}` }} bodyStyle={{ padding: '28px 32px' }}>
                <Row align="middle" gutter={24}>
                  <Col span={8} style={{ textAlign: 'center' }}>
                    <Progress type="circle" percent={latestDiagnosis.health_score} size={140}
                      strokeColor={{ '0%': '#10B981', '100%': '#3B82F6' }}
                      format={pct => (<div><div style={{ fontSize: 36, fontWeight: 700, color: DS.text }}>{pct}</div><div style={{ fontSize: 20, fontWeight: 600, color: '#10B981' }}>{latestDiagnosis.health_grade}</div></div>)} />
                  </Col>
                  <Col span={16}>
                    <Text strong style={{ fontSize: 16, display: 'block', marginBottom: 8 }}>AI 诊断总结</Text>
                    <Paragraph type="secondary" style={{ fontSize: 14, marginBottom: 12 }}>{latestDiagnosis.executive_summary}</Paragraph>
                    <Space>
                      <Tag color="blue" style={{ borderRadius: 6 }}>{latestDiagnosis.shop_name}</Tag>
                      <Text type="secondary" style={{ fontSize: 12 }}>{new Date(latestDiagnosis.created_at).toLocaleDateString('zh-CN')}</Text>
                    </Space>
                  </Col>
                </Row>
              </Card>

              {/* 问题分析 + 证据链 */}
              {(() => {
                const result = safeParse(latestDiagnosis.result_json);
                const problems = (result as any)?.problems || [];
                const evidence = (result as any)?.evidence_chains || [];
                return problems.length > 0 ? (
                  <Card title="问题分析" style={{ borderRadius: DS.radius, border: `1px solid ${DS.cardBorder}` }}>
                    <List dataSource={problems} renderItem={(p: any) => (
                      <List.Item>
                        <List.Item.Meta
                          title={<Space><Tag color={p.severity === 'P0' ? 'red' : p.severity === 'P1' ? 'orange' : 'blue'}>{p.severity}</Tag>{p.title}</Space>}
                          description={<><Text type="secondary">{p.cause}</Text><br /><Text type="secondary" style={{ fontSize: 12 }}>证据: {p.evidence} | 影响: {p.impact}</Text></>}
                        />
                      </List.Item>
                    )} />
                    {evidence.length > 0 && (
                      <>
                        <Divider />
                        <Text strong style={{ display: 'block', marginBottom: 8 }}>证据链</Text>
                        {evidence.map((e: any, i: number) => (
                          <Card key={i} size="small" style={{ marginBottom: 8, borderRadius: 8, background: '#FAFAFB' }}>
                            <Text type="secondary">{e.before} → {e.after}</Text><br />
                            <Text style={{ fontSize: 12 }}>影响: {e.impact}</Text>
                          </Card>
                        ))}
                      </>
                    )}
                  </Card>
                ) : null;
              })()}

              {/* 优化建议 + 行动计划 */}
              {(() => {
                const result = safeParse(latestDiagnosis.result_json);
                const suggestions = (result as any)?.suggestions || [];
                const actionPlan = (result as any)?.action_plan || [];
                return suggestions.length > 0 ? (
                  <Card title="优化建议 & 行动计划" style={{ borderRadius: DS.radius, border: `1px solid ${DS.cardBorder}` }}>
                    <List dataSource={suggestions} renderItem={(s: any) => (
                      <List.Item actions={[<Tag color="purple">{s.priority}</Tag>, <Text type="secondary" style={{ fontSize: 12 }}>{s.difficulty}难度 · {s.time_cost}</Text>]}>
                        <List.Item.Meta title={s.title} description={<Space>
                          <Text type="secondary" style={{ fontSize: 12 }}>{s.expected_improvement}</Text>
                        </Space>} />
                      </List.Item>
                    )} />
                    {actionPlan.length > 0 && (
                      <>
                        <Divider />
                        <Text strong style={{ display: 'block', marginBottom: 8 }}>行动计划</Text>
                        {actionPlan.map((a: any) => (
                          <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                            <input type="checkbox" /> <Text>{a.title}</Text> <Tag>{a.priority}</Tag>
                          </div>
                        ))}
                      </>
                    )}
                  </Card>
                ) : null;
              })()}
            </Space>
          </Col>

          {/* 右侧边栏 */}
          <Col span={8}>
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <Card title="导出报告" style={{ borderRadius: DS.radius, border: `1px solid ${DS.cardBorder}` }}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Button icon={<FilePdfOutlined />} block style={{ borderRadius: 8 }}>导出 PDF</Button>
                  <Button icon={<FileExcelOutlined />} block style={{ borderRadius: 8 }}>导出 Excel</Button>
                  <Button icon={<ShareAltOutlined />} block style={{ borderRadius: 8 }}>分享链接</Button>
                </Space>
              </Card>

              <Card title="诊断记录" style={{ borderRadius: DS.radius, border: `1px solid ${DS.cardBorder}` }}>
                <List size="small" dataSource={diagnoses.filter((d: any, i: number) => i === 0 || d.status === 'completed').slice(0, 5)}
                  renderItem={(d: any) => (
                    <List.Item>
                      <Space><Progress type="circle" size={30} percent={d.health_score} format={p => `${p}`} strokeColor="#10B981" />
                        <div>
                          <Text style={{ fontSize: 13 }}>{d.shop_name}</Text><br />
                          <Text type="secondary" style={{ fontSize: 11 }}>{new Date(d.created_at).toLocaleDateString('zh-CN')}</Text>
                        </div>
                        <Tag>{d.health_grade || 'N/A'}</Tag>
                      </Space>
                    </List.Item>
                  )}
                  locale={{ emptyText: '暂无记录' }} />
              </Card>

              <Button block onClick={() => navigate('/growth-center/review')} style={{ borderRadius: 8 }}>AI 复盘</Button>
            </Space>
          </Col>
        </Row>
      )}
    </div>
  );
}

function safeParse(json: string): any { try { return JSON.parse(json); } catch { return {}; } }
