import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Tag, Typography, Row, Col, Modal, Form, Select, InputNumber, Input, Space, Switch, Badge, Collapse, message, Empty, Tooltip } from 'antd';
import {
  ControlOutlined, PlusOutlined, ThunderboltOutlined,
  DeleteOutlined, EditOutlined, CopyOutlined,
  QuestionCircleOutlined, CheckCircleOutlined, InfoCircleOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';

const { Text, Title, Paragraph } = Typography;
const BRAND = '#2563eb';

interface RuleCondition {
  field: string;
  operator: string;
  value: number;
  time_range: string;
}

interface Rule {
  id: string;
  name: string;
  target_level: '系列' | '创意' | '商品';
  conditions: RuleCondition[];
  actions: { type: string; params: Record<string, any> }[];
  schedule: string;
  enabled: boolean;
}

interface RuleGroup {
  id: string;
  name: string;
  description: string;
  rules: Rule[];
  bound_campaigns: number;
  last_triggered: string | null;
  total_executions: number;
  today_executions: number;
}

const FIELD_OPTIONS = [
  { value: 'spend', label: '花费($)' },
  { value: 'orders', label: '订单数' },
  { value: 'revenue', label: '收入($)' },
  { value: 'roi', label: 'ROI' },
  { value: 'cpa', label: 'CPA($)' },
  { value: 'impressions', label: '展现量' },
  { value: 'clicks', label: '点击量' },
  { value: 'ctr', label: '点击率(%)' },
  { value: 'budget_consumed_ratio', label: '预算消耗率(%)' },
];

const ACTION_OPTIONS = [
  { value: 'adjust_budget', label: '调整预算', color: 'blue' },
  { value: 'pause_campaign', label: '暂停系列', color: 'orange' },
  { value: 'resume_campaign', label: '恢复系列', color: 'green' },
  { value: 'remove_creative', label: '移除创意', color: 'red' },
  { value: 'add_creative', label: '加回创意', color: 'purple' },
  { value: 'adjust_roi', label: '调整目标ROI', color: 'cyan' },
];

const AdRules: React.FC = () => {
  const [ruleGroups, setRuleGroups] = useState<RuleGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [wizardForm] = Form.useForm();

  useEffect(() => { loadRuleGroups(); }, []);

  const loadRuleGroups = async () => {
    setLoading(true);
    try {
      // TODO: 接入真实API
      const mock: RuleGroup[] = [
        {
          id: 'rg_1',
          name: '标准投放策略',
          description: '适用于大部分GMV Max系列的通用优化规则',
          bound_campaigns: 5,
          last_triggered: '2分钟前',
          total_executions: 1250,
          today_executions: 86,
          rules: [
            {
              id: 'r1', name: '高CPA自动优化', target_level: '系列',
              conditions: [{ field: 'cpa', operator: '>=', value: 50, time_range: 'today' }],
              actions: [{ type: 'adjust_budget', params: { action: 'decrease', ratio: 0.7 } }],
              schedule: '持续', enabled: true,
            },
            {
              id: 'r2', name: '花完预算自动加量', target_level: '系列',
              conditions: [{ field: 'budget_consumed_ratio', operator: '>=', value: 80, time_range: 'today' }],
              actions: [{ type: 'adjust_budget', params: { action: 'increase', amount: 50 } }],
              schedule: '持续', enabled: true,
            },
            {
              id: 'r3', name: '低质创意自动移除', target_level: '创意',
              conditions: [
                { field: 'spend', operator: '>=', value: 5, time_range: 'today' },
                { field: 'orders', operator: '=', value: 0, time_range: 'today' },
              ],
              actions: [{ type: 'remove_creative', params: { reason: '花费$5无订单' } }],
              schedule: '持续', enabled: true,
            },
          ],
        },
        {
          id: 'rg_2',
          name: '激进增长策略',
          description: '适合预算充足的爆品冲量场景',
          bound_campaigns: 2,
          last_triggered: '15分钟前',
          total_executions: 320,
          today_executions: 18,
          rules: [
            {
              id: 'r4', name: '爆品追投', target_level: '系列',
              conditions: [{ field: 'roi', operator: '>=', value: 4, time_range: 'last_7d' }],
              actions: [{ type: 'adjust_budget', params: { action: 'increase', ratio: 1.5 } }],
              schedule: '持续', enabled: true,
            },
          ],
        },
      ];
      setRuleGroups(mock);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRule = (groupId: string, ruleId: string, enabled: boolean) => {
    setRuleGroups(prev => prev.map(g =>
      g.id === groupId ? { ...g, rules: g.rules.map(r => r.id === ruleId ? { ...r, enabled } : r) } : g
    ));
  };

  const handleWizardSubmit = () => {
    wizardForm.validateFields().then(values => {
      message.success('智能规则已生成！请在规则组列表中查看');
      setShowWizard(false);
      setWizardStep(0);
      wizardForm.resetFields();
    });
  };

  const wizardContent = (
    <div style={{ padding: '8px 0' }}>
      {wizardStep === 0 && (
        <div>
          <Paragraph>
            <InfoCircleOutlined style={{ color: BRAND, marginRight: 6 }} />
            只需填写 8 个核心数值，系统自动生成最优规则组合
          </Paragraph>
          <Form form={wizardForm} layout="vertical">
            <Row gutter={[16, 0]}>
              <Col span={12}><Form.Item name="cpa_limit" label="转化成本上限($)" initialValue={6}><InputNumber min={1} max={100} style={{ width: '100%' }} /></Form.Item></Col>
              <Col span={12}><Form.Item name="creative_spend_limit" label="素材花费上限($)" initialValue={2}><InputNumber min={0.5} max={50} style={{ width: '100%' }} /></Form.Item></Col>
              <Col span={12}><Form.Item name="daily_budget" label="每日初始预算($)" initialValue={30}><InputNumber min={5} max={500} style={{ width: '100%' }} /></Form.Item></Col>
              <Col span={12}><Form.Item name="min_budget" label="最低预算($)" initialValue={20}><InputNumber min={5} max={200} style={{ width: '100%' }} /></Form.Item></Col>
              <Col span={12}><Form.Item name="cpa_high_threshold" label="CPA过高阈值($)" initialValue={15}><InputNumber min={5} max={100} style={{ width: '100%' }} /></Form.Item></Col>
              <Col span={12}><Form.Item name="budget_boost_ratio" label="消耗率触发加量(%)" initialValue={80}><InputNumber min={50} max={100} style={{ width: '100%' }} /></Form.Item></Col>
              <Col span={12}><Form.Item name="boost_amount" label="加量金额($)" initialValue={50}><InputNumber min={5} max={200} style={{ width: '100%' }} /></Form.Item></Col>
              <Col span={12}><Form.Item name="heat_budget" label="创意加热预算($)" initialValue={15}><InputNumber min={5} max={100} style={{ width: '100%' }} /></Form.Item></Col>
            </Row>
          </Form>
        </div>
      )}
      {wizardStep === 1 && (
        <div>
          <Title level={5} style={{ color: '#059669' }}>✓ AI 已为你生成 9 条规则</Title>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            {[
              'IF 今日CPA ≥ 15 → 降低预算至70%',
              'IF 消耗率 ≥ 80% → 增加预算$50',
              'IF 今日ROI < 目标 → 暂停系列并通知',
              'IF 创意花费 ≥ $2 AND 订单=0 → 移除该创意',
              'IF 近7天创意订单>0 AND CPA<$6 → 加回创意',
              'IF 创意状态=未投放 → 创建加热($15)',
              'IF 今日展现 < 100 → 增加预算20%',
              'IF 近3天ROI > 5 → 逐日递增预算10%',
              'IF 预算 < $20 → 恢复至$30初始预算',
            ].map((rule, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#f8fafc', borderRadius: 8, fontSize: 13 }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: BRAND, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0 }}>{i + 1}</div>
                <Text>{rule}</Text>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const actionColorMap: Record<string, string> = {};
  ACTION_OPTIONS.forEach(o => { actionColorMap[o.value] = o.color; });

  return (
    <div style={{ padding: '0 0 24px' }}>
      {/* 标题区 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, ${BRAND}, #60a5fa)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ControlOutlined style={{ color: '#fff', fontSize: 16 }} />
        </div>
        <div style={{ flex: 1 }}>
          <Title level={4} style={{ margin: 0, color: '#1e293b' }}>智能规则</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>条件触发 → 自动执行 → 解放双手，7×24 智能优化投放</Text>
        </div>
        <Space>
          <Button icon={<ThunderboltOutlined />} onClick={() => setShowWizard(true)} style={{ borderRadius: 8, borderColor: '#d97706', color: '#d97706' }}>
            智能生成规则
          </Button>
          <Button type="primary" icon={<PlusOutlined />} style={{ borderRadius: 8 }}>
            创建规则组
          </Button>
        </Space>
      </div>

      {ruleGroups.length === 0 && !loading ? (
        <Card style={{ borderRadius: 12, border: 'none', textAlign: 'center', padding: 60 }}>
          <Empty
            image={<ControlOutlined style={{ fontSize: 48, color: '#cbd5e1' }} />}
            description={
              <div>
                <Title level={5} style={{ color: '#64748b' }}>还没有规则组</Title>
                <Paragraph type="secondary" style={{ maxWidth: 420, margin: '8px auto' }}>
                  规则组 = 策略包，内含多条投放规则。创建后绑定到系列即可自动管理优化。
                  <br />也可以使用 <Text strong style={{ color: '#d97706' }}>智能生成</Text> 快速创建。
                </Paragraph>
              </div>
            }
          />
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {ruleGroups.map(group => (
            <Card
              key={group.id}
              style={{ borderRadius: 12, border: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <ControlOutlined style={{ color: BRAND, fontSize: 16 }} />
                  <div>
                    <Text strong style={{ fontSize: 15 }}>{group.name}</Text>
                    <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>{group.description}</Text>
                  </div>
                  <Badge count={group.rules.length} style={{ backgroundColor: BRAND }} title="规则数量" />
                  <Tag color="geekblue">绑定 {group.bound_campaigns} 系列</Tag>
                  <div style={{ marginLeft: 'auto', fontSize: 12 }}>
                    <Text type="secondary">今日执行 </Text>
                    <Text strong style={{ color: BRAND }}>{group.today_executions}</Text>
                    <Text type="secondary"> 次 · 累计 </Text>
                    <Text strong>{group.total_executions}</Text>
                    <Text type="secondary"> 次</Text>
                    {group.last_triggered && <Text type="secondary" style={{ marginLeft: 8 }}>最近: {group.last_triggered}</Text>}
                  </div>
                </div>
              }
              bodyStyle={{ padding: '0 20px 16px' }}
              extra={
                <Space>
                  <Button size="small" icon={<EditOutlined />} type="link">编辑</Button>
                  <Button size="small" icon={<DeleteOutlined />} type="link" danger>删除</Button>
                </Space>
              }
            >
              <Table
                dataSource={group.rules}
                rowKey="id"
                size="small"
                pagination={false}
                showHeader={false}
                columns={[
                  {
                    title: '规则', key: 'rule', width: '38%',
                    render: (_: any, r: Rule) => (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <Switch checked={r.enabled} size="small" onChange={(v) => handleToggleRule(group.id, r.id, v)} />
                          <Text strong style={{ fontSize: 13 }}>{r.name}</Text>
                          <Tag style={{ fontSize: 10, lineHeight: '16px' }}>{r.target_level}层</Tag>
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>
                          {r.conditions.map((c, ci) => (
                            <span key={ci}>
                              {ci > 0 ? ' AND ' : ''}
                              {FIELD_OPTIONS.find(f => f.value === c.field)?.label ?? c.field} {c.operator} {c.value} ({c.time_range === 'today' ? '今天' : '近7天'})
                            </span>
                          ))}
                        </div>
                      </div>
                    ),
                  },
                  {
                    title: '操作', key: 'action', width: 80, align: 'center',
                    render: () => <ArrowRightOutlined style={{ color: '#94a3b8' }} />,
                  },
                  {
                    title: '执行动作', key: 'actions', width: '40%',
                    render: (_: any, r: Rule) => (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {r.actions.map((a, ai) => {
                          const opt = ACTION_OPTIONS.find(o => o.value === a.type);
                          return (
                            <Tag key={ai} color={opt?.color || 'default'} style={{ fontSize: 11 }}>
                              {opt?.label || a.type}
                              {a.params.ratio ? ` ×${a.params.ratio}` : ''}
                              {a.params.amount ? ` +$${a.params.amount}` : ''}
                            </Tag>
                          );
                        })}
                      </div>
                    ),
                  },
                  {
                    title: '周期', dataIndex: 'schedule', key: 'schedule', width: 60, align: 'center',
                    render: (v: string) => <Tag style={{ fontSize: 11 }}>{v}</Tag>,
                  },
                ]}
              />
            </Card>
          ))}
        </div>
      )}

      {/* 智能生成弹窗 */}
      <Modal
        title={<span><ThunderboltOutlined style={{ color: '#d97706', marginRight: 8 }} />智能生成投放规则</span>}
        open={showWizard}
        onCancel={() => { setShowWizard(false); setWizardStep(0); wizardForm.resetFields(); }}
        onOk={wizardStep === 0 ? () => setWizardStep(1) : handleWizardSubmit}
        okText={wizardStep === 0 ? '生成规则' : '确认创建'}
        width={640}
        style={{ top: 40 }}
        styles={{ body: { padding: '16px 24px' } }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: wizardStep === 0 ? BRAND : '#059669', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>1</div>
            <div style={{ width: 40, height: 2, background: wizardStep === 1 ? '#059669' : '#e2e8f0' }} />
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: wizardStep === 1 ? '#059669' : '#e2e8f0', color: wizardStep === 1 ? '#fff' : '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>2</div>
          </div>
        </div>
        {wizardContent}
      </Modal>
    </div>
  );
};

export default AdRules;
