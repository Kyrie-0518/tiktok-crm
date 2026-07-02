import React, { useEffect, useState, useCallback } from 'react';
import {
  Card, Tabs, Form, Input, Button, DatePicker, Upload, Table, message,
  Space, Tag, Popconfirm, Empty, Spin, Row, Col, Typography, Modal,
} from 'antd';
import {
  FileTextOutlined, UploadOutlined, BarChartOutlined,
  CalendarOutlined, PlusOutlined, DeleteOutlined, ReloadOutlined,
  DownloadOutlined, SendOutlined, HistoryOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../api';

const { TextArea } = Input;
const { Title, Paragraph } = Typography;

export default function SkiisAnalysis() {
  const [activeTab, setActiveTab] = useState('daily');
  const [dailyLogs, setDailyLogs] = useState<any[]>([]);
  const [dataFiles, setDataFiles] = useState<any[]>([]);
  const [weeklyReports, setWeeklyReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 日报表单
  const [dailyForm] = Form.useForm();
  const [selectedDate, setSelectedDate] = useState(dayjs());

  // 数据文件
  const [uploading, setUploading] = useState(false);
  const [dataDimension, setDataDimension] = useState('');

  // 周报
  const [weeklyRange, setWeeklyRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().startOf('week').add(1, 'day'), // 周一
    dayjs().endOf('week').add(1, 'day'),   // 周日
  ]);
  const [weeklySummaryData, setWeeklySummaryData] = useState<any>(null);
  const [weeklyForm] = Form.useForm();

  // ───────────────────────────────────
  //  数据加载
  // ───────────────────────────────────

  const loadDailyLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/skiis/daily-logs', {
        params: {
          date_from: dayjs().startOf('month').format('YYYY-MM-DD'),
          date_to: dayjs().format('YYYY-MM-DD'),
        },
      });
      setDailyLogs(res.data?.list || []);
    } catch { message.error('加载日报失败'); }
    finally { setLoading(false); }
  }, []);

  const loadDataFiles = useCallback(async () => {
    try {
      const res = await api.get('/skiis/data-files');
      setDataFiles(res.data?.list || []);
    } catch {}
  }, []);

  const loadWeeklyReports = useCallback(async () => {
    try {
      const res = await api.get('/skiis/weekly-reports');
      setWeeklyReports(res.data?.list || []);
    } catch {}
  }, []);

  useEffect(() => { loadDailyLogs(); loadDataFiles(); loadWeeklyReports(); }, []);

  // ───────────────────────────────────
  //  每日工作记录
  // ───────────────────────────────────

  const handleDailySubmit = async (values: any) => {
    if (!selectedDate) { message.warning('请选择日期'); return; }
    setSubmitting(true);
    try {
      await api.post('/skiis/daily-logs', {
        log_date: selectedDate.format('YYYY-MM-DD'),
        content: values.content,
      });
      message.success('日报已保存');
      dailyForm.resetFields();
      loadDailyLogs();
    } catch (e: any) {
      message.error(e.response?.data?.error || '保存失败');
    } finally { setSubmitting(false); }
  };

  const handleDeleteDaily = async (id: number) => {
    await api.delete(`/skiis/daily-logs/${id}`);
    message.success('已删除');
    loadDailyLogs();
  };

  const handleEditDaily = (record: any) => {
    setSelectedDate(dayjs(record.log_date));
    dailyForm.setFieldsValue({ content: record.content });
    setActiveTab('daily');
  };

  // ───────────────────────────────────
  //  数据文件上传
  // ───────────────────────────────────

  const handleUpload = async (options: any) => {
    const { file, onSuccess, onError } = options;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('dimension', dataDimension || '');
      const res = await api.post('/skiis/data-files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      message.success(`文件 ${file.name} 已上传`);
      onSuccess(res.data, file);
      loadDataFiles();
    } catch (e: any) {
      onError(e);
      message.error('上传失败');
    } finally { setUploading(false); }
  };

  const handleDeleteFile = async (id: number) => {
    await api.delete(`/skiis/data-files/${id}`);
    message.success('已删除');
    loadDataFiles();
  };

  const handleReviewFile = async (id: number) => {
    try {
      const res = await api.get(`/skiis/data-files/${id}/review`);
      const data = res.data;
      Modal.info({
        title: `预览: ${data.file_name}`,
        width: 700,
        content: (
          <div>
            {data.dimension && <Tag color="blue" style={{ marginBottom: 8 }}>{data.dimension}</Tag>}
            <pre style={{ maxHeight: 400, overflow: 'auto', background: '#f5f5f5', padding: 12, borderRadius: 6, fontSize: 12, whiteSpace: 'pre-wrap' }}>
              {data.content || '（空文件或无法预览）'}
            </pre>
          </div>
        ),
      });
    } catch {
      message.error('预览失败');
    }
  };

  // ───────────────────────────────────
  //  周报
  // ───────────────────────────────────

  const loadWeeklySummary = async () => {
    if (!weeklyRange[0] || !weeklyRange[1]) return;
    setLoading(true);
    try {
      const res = await api.get('/skiis/weekly-summary', {
        params: {
          week_start: weeklyRange[0].format('YYYY-MM-DD'),
          week_end: weeklyRange[1].format('YYYY-MM-DD'),
        },
      });
      setWeeklySummaryData(res.data);
    } catch { message.error('加载周报数据失败'); }
    finally { setLoading(false); }
  };

  const handleSaveWeekly = async (values: any) => {
    setSubmitting(true);
    try {
      await api.post('/skiis/weekly-reports', {
        week_start: weeklyRange[0].format('YYYY-MM-DD'),
        week_end: weeklyRange[1].format('YYYY-MM-DD'),
        summary: values.summary || '',
        data_analysis: values.data_analysis || '',
        action_items: values.action_items || '',
      });
      message.success('周报已保存');
      loadWeeklyReports();
    } catch (e: any) {
      message.error(e.response?.data?.error || '保存失败');
    } finally { setSubmitting(false); }
  };

  const handleDeleteWeekly = async (id: number) => {
    await api.delete(`/skiis/weekly-reports/${id}`);
    message.success('已删除');
    loadWeeklyReports();
  };

  const handleViewWeekly = async (id: number) => {
    try {
      const res = await api.get(`/skiis/weekly-reports/${id}`);
      const r = res.data;
      Modal.info({
        title: `📋 周报 (${r.week_start} ~ ${r.week_end})`,
        width: 750,
        content: (
          <div style={{ maxHeight: 500, overflow: 'auto' }}>
            <Title level={5}>工作总结</Title>
            <Paragraph style={{ whiteSpace: 'pre-wrap' }}>{r.summary || '无'}</Paragraph>
            <Title level={5}>数据分析</Title>
            <Paragraph style={{ whiteSpace: 'pre-wrap' }}>{r.data_analysis || '无'}</Paragraph>
            <Title level={5}>下周关注</Title>
            <Paragraph style={{ whiteSpace: 'pre-wrap' }}>{r.action_items || '无'}</Paragraph>
          </div>
        ),
      });
    } catch { message.error('加载失败'); }
  };

  const generateWeeklyDraft = () => {
    if (!weeklySummaryData) return;
    const logs = weeklySummaryData.daily_logs || [];
    const files = weeklySummaryData.data_files || [];

    let summary = '## 本周工作总结\n\n';
    if (logs.length > 0) {
      logs.forEach((log: any) => {
        summary += `### ${log.log_date}\n${log.content}\n\n`;
      });
    } else {
      summary += '（本周暂无每日工作记录）\n\n';
    }

    let analysis = '## 数据分析\n\n';
    if (files.length > 0) {
      analysis += `本周共上传 ${files.length} 个数据文件：\n`;
      files.forEach((f: any) => {
        analysis += `- ${f.file_name}${f.dimension ? ` [${f.dimension}]` : ''}\n`;
      });
      analysis += '\n（请根据上传的数据文件补充分析结论）\n';
    } else {
      analysis += '（本周暂无上传数据文件）\n';
    }

    let action = '## 下周关注\n\n（请补充）';

    weeklyForm.setFieldsValue({ summary, data_analysis: analysis, action_items: action });
  };

  // ───────────────────────────────────
  //  渲染
  // ───────────────────────────────────

  const dailyColumns = [
    { title: '日期', dataIndex: 'log_date', width: 120, render: (v: string) => <Tag color="blue">{v}</Tag> },
    {
      title: '工作内容', dataIndex: 'content', ellipsis: true,
      render: (v: string) => <span style={{ whiteSpace: 'pre-wrap' }}>{v}</span>,
    },
    { title: '记录时间', dataIndex: 'created_at', width: 160 },
    {
      title: '操作', width: 120,
      render: (_: any, r: any) => (
        <Space>
          <Button size="small" onClick={() => handleEditDaily(r)}>编辑</Button>
          <Popconfirm title="确认删除？" onConfirm={() => handleDeleteDaily(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const fileColumns = [
    { title: '文件名', dataIndex: 'file_name', width: 200 },
    { title: '维度', dataIndex: 'dimension', width: 100, render: (v: string) => v ? <Tag color="green">{v}</Tag> : '-' },
    { title: '上传时间', dataIndex: 'uploaded_at', width: 160 },
    {
      title: '操作', width: 160,
      render: (_: any, r: any) => (
        <Space>
          <Button size="small" onClick={() => handleReviewFile(r.id)}>预览</Button>
          <Popconfirm title="确认删除？" onConfirm={() => handleDeleteFile(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const weeklyColumns = [
    { title: '周期', key: 'range', width: 180, render: (_: any, r: any) => `${r.week_start} ~ ${r.week_end}` },
    { title: '汇报人', dataIndex: 'display_name', width: 100 },
    {
      title: '工作总结', dataIndex: 'summary', ellipsis: true,
      render: (v: string) => v ? <span>{v.slice(0, 80)}{v.length > 80 ? '...' : ''}</span> : '-',
    },
    { title: '创建时间', dataIndex: 'created_at', width: 160 },
    {
      title: '操作', width: 160,
      render: (_: any, r: any) => (
        <Space>
          <Button size="small" onClick={() => handleViewWeekly(r.id)}>查看</Button>
          <Popconfirm title="确认删除？" onConfirm={() => handleDeleteWeekly(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '20px 24px', background: '#f5f3f0', minHeight: '100%' }}>
      {/* 页面标题 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 18,
          }}>
            <BarChartOutlined />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1e293b' }}>SKIIS 数据分析</h2>
            <span style={{ fontSize: 12, color: '#999' }}>每日工作 · 数据文件分析 · 周报汇总</span>
          </div>
        </div>
        <Button icon={<ReloadOutlined />} onClick={() => { loadDailyLogs(); loadDataFiles(); loadWeeklyReports(); }}>
          刷新
        </Button>
      </div>

      <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
        // ──────────── Tab 1: 每日工作 ────────────
        {
          key: 'daily',
          label: <span><FileTextOutlined /> 每日工作</span>,
          children: (
            <Row gutter={16}>
              <Col span={10}>
                <Card title="📝 记录今日工作" size="small">
                  <Form form={dailyForm} layout="vertical" onFinish={handleDailySubmit}>
                    <Form.Item label="日期">
                      <DatePicker
                        value={selectedDate}
                        onChange={(d) => setSelectedDate(d || dayjs())}
                        style={{ width: '100%' }}
                        allowClear={false}
                      />
                    </Form.Item>
                    <Form.Item name="content" label="工作内容" rules={[{ required: true, message: '请输入今日工作内容' }]}>
                      <TextArea rows={6} placeholder="自由描述今天做了什么——达人跟进、店铺数据变化、素材优化、广告调整等..." />
                    </Form.Item>
                    <Button type="primary" htmlType="submit" loading={submitting} block icon={<SendOutlined />}>
                      保存工作记录
                    </Button>
                  </Form>
                </Card>
              </Col>
              <Col span={14}>
                <Card title="📅 本月工作记录" size="small">
                  <Table
                    dataSource={dailyLogs}
                    columns={dailyColumns}
                    rowKey="id"
                    loading={loading}
                    size="small"
                    pagination={{ pageSize: 8 }}
                    locale={{ emptyText: <Empty description="暂无记录，左侧输入今日工作" /> }}
                    scroll={{ x: 600 }}
                  />
                </Card>
              </Col>
            </Row>
          ),
        },
        // ──────────── Tab 2: 数据上传 ────────────
        {
          key: 'data',
          label: <span><UploadOutlined /> 数据上传</span>,
          children: (
            <div>
              <Card size="small" style={{ marginBottom: 16 }}>
                <Space wrap>
                  <Input
                    placeholder="数据维度（如：GMV/素材/广告）"
                    value={dataDimension}
                    onChange={(e) => setDataDimension(e.target.value)}
                    style={{ width: 220 }}
                  />
                  <Upload
                    customRequest={handleUpload as any}
                    showUploadList={false}
                    accept=".xlsx,.xls,.csv,.json"
                  >
                    <Button type="primary" icon={<UploadOutlined />} loading={uploading}>
                      上传数据文件
                    </Button>
                  </Upload>
                </Space>
                <div style={{ fontSize: 12, color: '#999', marginTop: 8 }}>
                  支持格式: .xlsx / .csv / .json，单文件最大 20MB
                </div>
              </Card>

              <Table
                dataSource={dataFiles}
                columns={fileColumns}
                rowKey="id"
                size="small"
                pagination={{ pageSize: 10 }}
                locale={{ emptyText: <Empty description="暂无上传文件" /> }}
                scroll={{ x: 600 }}
              />
            </div>
          ),
        },
        // ──────────── Tab 3: 周报汇总 ────────────
        {
          key: 'weekly',
          label: <span><CalendarOutlined /> 周报汇总</span>,
          children: (
            <Row gutter={16}>
              <Col span={14}>
                <Card title="📋 生成周报" size="small">
                  <Space style={{ marginBottom: 16 }} wrap>
                    <DatePicker.RangePicker
                      value={weeklyRange as any}
                      onChange={(dates) => setWeeklyRange(dates as [dayjs.Dayjs, dayjs.Dayjs])}
                      format="YYYY-MM-DD"
                      picker="week"
                    />
                    <Button icon={<BarChartOutlined />} onClick={loadWeeklySummary} loading={loading}>
                      汇总本周数据
                    </Button>
                    <Button icon={<DownloadOutlined />} onClick={generateWeeklyDraft}>
                      生成草稿
                    </Button>
                  </Space>

                  {weeklySummaryData && (
                    <div style={{ marginBottom: 12, background: '#f6f8fa', padding: 12, borderRadius: 8, fontSize: 13 }}>
                      <div>📝 本周每日记录: <b>{weeklySummaryData.daily_logs?.length || 0}</b> 条</div>
                      <div>📊 本周上传数据文件: <b>{weeklySummaryData.data_files?.length || 0}</b> 个</div>
                    </div>
                  )}

                  <Form form={weeklyForm} layout="vertical" onFinish={handleSaveWeekly}>
                    <Form.Item name="summary" label="工作总结">
                      <TextArea rows={8} placeholder="本周工作总结（以数据总结为主，融入工作内容）..." />
                    </Form.Item>
                    <Form.Item name="data_analysis" label="数据分析">
                      <TextArea rows={8} placeholder="按店铺/GMV/素材/广告等维度分点输出分析结论..." />
                    </Form.Item>
                    <Form.Item name="action_items" label="下周关注">
                      <TextArea rows={3} placeholder="基于分析结论的行动建议..." />
                    </Form.Item>
                    <Button type="primary" htmlType="submit" loading={submitting} icon={<SendOutlined />}>
                      保存周报
                    </Button>
                  </Form>
                </Card>
              </Col>
              <Col span={10}>
                <Card title={<span><HistoryOutlined /> 历史周报</span>} size="small">
                  <Table
                    dataSource={weeklyReports}
                    columns={weeklyColumns}
                    rowKey="id"
                    size="small"
                    pagination={{ pageSize: 6 }}
                    locale={{ emptyText: <Empty description="暂无周报" /> }}
                    scroll={{ x: 500 }}
                  />
                </Card>
              </Col>
            </Row>
          ),
        },
      ]} />
    </div>
  );
}
