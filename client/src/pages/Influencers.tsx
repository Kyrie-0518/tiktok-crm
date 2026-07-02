import React, { useEffect, useState, useCallback } from 'react';
import {
  Card, Table, Button, Space, Input, Select, Tag, Modal, Form, message,
  Popconfirm, DatePicker, InputNumber, Row, Col, Upload, Tooltip, Tabs,
  Statistic, List, Badge, Dropdown,
} from 'antd';
import {
  SearchOutlined, PlusOutlined, EditOutlined, DeleteOutlined,
  UploadOutlined, LinkOutlined, ReloadOutlined, CalendarOutlined,
  UserOutlined, FileTextOutlined, SendOutlined, HistoryOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useInfluencerStore } from '../stores/influencerStore';
import api from '../api';
import { useHasPerm } from '../stores/authStore';
import DataTable from '../components/DataTable';
import ExportButton from '../components/ExportButton';

const BRAND_COLOR = '#2563eb';

const COOPERATION_TYPES = [
  { value: '纯佣', label: '纯佣' },
  { value: '坑位费', label: '坑位费' },
  { value: '纯坑位', label: '纯坑位' },
  { value: '置换', label: '置换' },
];

const CONTACT_CHANNELS = [
  { value: 'TikTok私信', label: 'TikTok私信' },
  { value: '邮件', label: '邮件' },
  { value: 'WhatsApp', label: 'WhatsApp' },
  { value: '其他', label: '其他' },
];

// 建联进度选项
const PROGRESS_OPTIONS = [
  { value: '未回复', label: '未回复', color: '#faad14', bgColor: '#fffbe6' },
  { value: '已回复', label: '已回复', color: '#2563eb', bgColor: '#e6f4ff' },
  { value: '待寄样', label: '待寄样', color: '#722ed1', bgColor: '#f9f0ff' },
  { value: '待签收', label: '待签收', color: '#13c2c2', bgColor: '#e6fffb' },
  { value: '待拍摄', label: '待拍摄', color: '#eb2f96', bgColor: '#fff0f6' },
  { value: '已完成', label: '已完成', color: '#52c41a', bgColor: '#f6ffed' },
];

// 根据进度获取颜色
const getProgressStyle = (value: string) => {
  const opt = PROGRESS_OPTIONS.find(o => o.value === value);
  return opt ? { color: opt.color, background: opt.bgColor } : {};
};

// 店铺配色方案
const SHOP_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  'HomeLife Co':   { color: '#2563eb', bg: '#e6f4ff', border: '#91caff' },
  'FreshGuard':    { color: '#722ed1', bg: '#f9f0ff', border: '#b37feb' },
};

// 获取店铺样式（按名称匹配，未命中则默认）
const getShopStyle = (name: string) => {
  const s = SHOP_COLORS[name];
  return s || { color: '#666', bg: '#f5f5f5', border: '#d9d9d9' };
};

export default function Influencers() {
  const canEdit = useHasPerm('influencers', 'edit');
  const store = useInfluencerStore();
  const [shops, setShops] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [keyword, setKeyword] = useState('');
  const [coopFilter, setCoopFilter] = useState<string | null>(null);
  const [shopFilter, setShopFilter] = useState<number | null>(null);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([null, null]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [form] = Form.useForm();

  // 汇报相关状态
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportHistoryOpen, setReportHistoryOpen] = useState(false);
  const [reportType, setReportType] = useState<'daily' | 'weekly'>('daily');
  const [shopStatsList, setShopStatsList] = useState<any[]>([]); // 按店铺统计
  const [reports, setReports] = useState<any[]>([]);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [feishuUrl, setFeishuUrl] = useState<string | null>(null);
  const [reportForm] = Form.useForm();
  const [viewingReport, setViewingReport] = useState<any>(null); // 查看详情的记录
  const [isEditingReport, setIsEditingReport] = useState(false); // 是否在编辑模式
  const [editShopStatsList, setEditShopStatsList] = useState<any[]>([]); // 编辑时的店铺数据
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [reportDetailForm] = Form.useForm(); // 详情弹窗编辑表单
  const [materialUrls, setMaterialUrls] = useState<string[]>(['']); // 素材链接多行

  // Load shops (from tiktok_shops, not product-linked shops)
  useEffect(() => {
    api.get('/shops').then(r => {
      const data = r.data || [];
      setShops(data);
      if (data.length === 0) {
        message.warning('暂无店铺数据，请先在「店铺管理」中添加店铺');
      }
    }).catch((err) => {
      message.error('加载店铺失败：' + (err.response?.data?.error || err.message));
    });
    api.get('/products').then(r => setProducts(r.data || [])).catch(() => {});
  }, []);

  const loadData = useCallback(() => {
    store.fetchInfluencers({
      keyword: keyword || undefined,
      cooperation_type: coopFilter || undefined,
      shop_id: shopFilter || undefined,
      contact_date_from: dateRange[0]?.format('YYYY-MM-DD') || undefined,
      contact_date_to: dateRange[1]?.format('YYYY-MM-DD') || undefined,
      page: store.page,
    });
  }, [keyword, coopFilter, shopFilter, dateRange, store.page]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSearch = () => {
    store.setPage(1);
    store.fetchInfluencers({
      keyword,
      cooperation_type: coopFilter || undefined,
      shop_id: shopFilter || undefined,
      contact_date_from: dateRange[0]?.format('YYYY-MM-DD') || undefined,
      contact_date_to: dateRange[1]?.format('YYYY-MM-DD') || undefined,
      page: 1
    });
  };

  const openModal = (record?: any) => {
    if (record) {
      setEditingRecord(record);
      // 解析已有素材链接
      let urls: string[] = [''];
      try {
        if (record.material_url) {
          const parsed = JSON.parse(record.material_url);
          urls = Array.isArray(parsed) && parsed.length > 0 ? parsed : [record.material_url];
        }
      } catch { urls = record.material_url ? [record.material_url] : ['']; }
      setMaterialUrls(urls);
      form.setFieldsValue({
        ...record,
        contact_date: record.contact_date ? dayjs(record.contact_date) : undefined,
        send_date: record.send_date ? dayjs(record.send_date) : undefined,
        receive_date: record.receive_date ? dayjs(record.receive_date) : undefined,
        material_schedule: record.material_schedule ? dayjs(record.material_schedule) : undefined,
        status: record.status || '未回复',
      });
    } else {
      setEditingRecord(null);
      setMaterialUrls(['']); // 新增默认一行空
      form.resetFields();
      // Default values for new influencer
      form.setFieldsValue({
        contact_channel: 'WhatsApp',
        cooperation_type: '纯佣',
        commission_rate: 10,
        status: '未回复',
      });
    }
    setModalOpen(true);
  };

  const handleSubmit = async (values: any) => {
    // 过滤空素材链接并序列化
    const validUrls = materialUrls.filter(u => u && u.trim() !== '');
    const payload = {
      ...values,
      contact_date: values.contact_date?.format('YYYY-MM-DD') || '',
      send_date: values.send_date?.format('YYYY-MM-DD') || '',
      receive_date: values.receive_date?.format('YYYY-MM-DD') || '',
      material_schedule: values.material_schedule?.format('YYYY-MM-DD') || '',
      material_url: JSON.stringify(validUrls),
      commission_rate: values.commission_rate ? Math.round(Number(values.commission_rate) * 100) / 100 : 0,
    };
    try {
      if (editingRecord) {
        await store.updateInfluencer(editingRecord.id, payload);
        message.success('达人信息已更新');
      } else {
        await store.createInfluencer(payload);
        message.success('达人添加成功');
      }
      setModalOpen(false);
    } catch (e: any) {
      message.error(e.response?.data?.error || '操作失败');
    }
  };

  const handleDelete = async (id: number) => {
    await store.deleteInfluencer(id);
    message.success('已删除');
  };

  // 更新建联进度
  const handleProgressChange = async (id: number, progress: string) => {
    try {
      await store.updateInfluencer(id, { status: progress });
      message.success('进度已更新');
    } catch (e: any) {
      message.error(e.response?.data?.error || '更新失败');
    }
  };

  const handleExport = async () => {
    try {
      const res = await api.get('/influencers/export/all');
      const data = res.data || [];
      if (data.length === 0) { message.info('暂无数据'); return; }
      const headers = ['店铺', '达人ID', '达人主页', '建联渠道', '联系信息', '合作方式', '佣金比例(%)', '样品名称', '样品数量', '样品成本', '建联日期', '寄样日期', '收货日期', '素材排期', '素材链接', '备注'];
      const rows = data.map((r: any) => {
        // 解析素材链接数组
        let materialUrlStr = '';
        try {
          if (r.material_url) {
            const parsed = JSON.parse(r.material_url);
            materialUrlStr = Array.isArray(parsed) ? parsed.join('; ') : r.material_url;
          }
        } catch { materialUrlStr = r.material_url || ''; }
        return [
          r.shop_name || '', r.influencer_id || '', r.profile_url || '',
          r.contact_channel || '', r.contact_info || '', r.cooperation_type || '',
          r.commission_rate || 0,
          r.product_name || '', r.sample_qty || '', r.sample_cost || 0,
          r.contact_date || '', r.send_date || '', r.receive_date || '', r.material_schedule || '',
          materialUrlStr, r.remark || '',
        ];
      });
      let csv = '\uFEFF' + headers.join(',') + '\n';
      rows.forEach((row: string[]) => {
        csv += row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',') + '\n';
      });
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `达人管理_${dayjs().format('YYYY-MM-DD')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      message.success('导出成功');
    } catch {
      message.error('导出失败');
    }
  };

  const handleImport = async (file: File) => {
    setImportModalOpen(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/influencers/batch-import/file', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000,
      });
      const d = res.data;
      message.success(`导入完成：成功 ${d.success} 条${d.failed ? `，失败 ${d.failed} 条` : ''}`);
      if (d.errors?.length) console.warn('导入错误详情:', d.errors);
      loadData();
    } catch (err: any) {
      message.error(err.response?.data?.error || err.message || '导入失败');
    } finally {
      setImportModalOpen(false);
    }
    return false; // 阻止默认上传
  };

  // Watch product_id changes to auto-calc cost
  const watchProductId = Form.useWatch('product_id', form);
  const watchSampleQty = Form.useWatch('sample_qty', form);
  const calcCost = () => {
    if (watchProductId && watchSampleQty) {
      const prod = products.find(p => p.id === watchProductId);
      if (prod) return ((prod.cost_price || 0) * (watchSampleQty || 1)).toFixed(2);
    }
    return '0.00';
  };

  // ========== 汇报功能（多店铺统计）==========

  const loadShopStats = async () => {
    try {
      const res = await api.get('/influencer-reports/stats/prefill');
      setShopStatsList(res.data || []);
    } catch { /* ignore */ }
  };

  const loadFeishuConfig = async () => {
    try {
      const res = await api.get('/settings');
      const settings = res.data || {};
      if (settings.feishu_webhook) {
        setFeishuUrl(settings.feishu_webhook.url || null);
      }
    } catch { /* ignore */ }
  };

  const openReportModal = async (type: 'daily' | 'weekly') => {
    setReportType(type);
    await loadShopStats();
    setReportModalOpen(true);
  };

  // 提交汇报
  const handleReportSubmit = async (values: any) => {
    // 校验各店铺4个必填项（允许数字为0）
    for (const shop of shopStatsList) {
      if (shop.invite_count === undefined || shop.invite_count === null ||
          shop.contact_count === undefined || shop.contact_count === null ||
          shop.sample_sent === undefined || shop.sample_sent === null ||
          shop.video_output === undefined || shop.video_output === null) {
        message.error(`「${shop.shop_name}」的达人邀约数量、有效建联数量、寄样达人数、产出视频数均为必填项`);
        return;
      }
    }
    setReportSubmitting(true);
    try {
      const payload = {
        report_type: reportType,
        report_date: values.report_date?.format('YYYY-MM-DD') || dayjs().format('YYYY-MM-DD'),
        stats_by_shop: shopStatsList.map(s => ({
          shop_id: s.shop_id,
          shop_name: s.shop_name,
          invite_count: s.invite_count || 0,
          contact_count: s.contact_count || 0,
          sample_sent: s.sample_sent || 0,
          video_output: s.video_output || 0,
          analysis_summary: s.analysis_summary || '',
        })),
        summary: values.summary || '',
        plan: '',
        issues: values.issues || '',
        needs: values.needs || '',
      };
      const res = await api.post('/influencer-reports', payload);
      const data = res.data;
      if (data.feishu_synced) {
        message.success(`汇报${data.is_update ? '已更新' : '已提交'}，已同步到飞书群`);
      } else {
        message.warning(`汇报${data.is_update ? '已更新' : '已提交'}，但飞书同步失败：${data.feishu_error || '请检查飞书配置'}`);
      }
      setReportModalOpen(false);
    } catch (e: any) {
      message.error(e.response?.data?.error || '提交失败');
    } finally {
      setReportSubmitting(false);
    }
  };

  // 更新某个店铺的统计数据
  const updateShopStat = (shopId: number, field: string, value: any) => {
    setShopStatsList(prev =>
      prev.map(s => s.shop_id === shopId ? { ...s, [field]: value } : s)
    );
  };

  const loadReports = async (type?: string) => {
    try {
      const res = await api.get('/influencer-reports', {
        params: { report_type: type, page_size: 50 },
      });
      setReports(res.data?.list || []);
    } catch { /* ignore */ }
  };

  const openReportHistory = () => {
    loadReports();
    loadFeishuConfig();
    setReportHistoryOpen(true);
  };

  const resendToFeishu = async (reportId: number) => {
    try {
      const res = await api.post(`/influencer-reports/${reportId}/resend`);
      if (res.data.success) {
        message.success('已重新推送到飞书');
        loadReports();
      } else {
        message.error(res.data.error || '推送失败');
      }
    } catch (e: any) {
      message.error(e.response?.data?.error || '推送失败');
    }
  };

  // 进入编辑模式
  const enterEditReport = () => {
    if (!viewingReport) return;
    try {
      const shopData = JSON.parse(viewingReport.stats_by_shop || '[]');
      setEditShopStatsList(shopData.map((s: any) => ({ ...s })));
    } catch { setEditShopStatsList([]); }
    reportDetailForm.setFieldsValue({
      report_date: viewingReport.report_date ? dayjs(viewingReport.report_date) : undefined,
      summary: viewingReport.summary || '',
      issues: viewingReport.issues || '',
      needs: viewingReport.needs || '',
    });
    setIsEditingReport(true);
  };

  // 更新编辑中的店铺数据
  const updateEditShopStat = (shopId: number, field: string, value: any) => {
    setEditShopStatsList(prev =>
      prev.map(s => s.shop_id === shopId ? { ...s, [field]: value } : s)
    );
  };

  // 保存编辑
  const handleSaveEdit = async (values: any) => {
    for (const shop of editShopStatsList) {
      if (shop.invite_count === undefined || shop.invite_count === null ||
          shop.contact_count === undefined || shop.contact_count === null ||
          shop.sample_sent === undefined || shop.sample_sent === null ||
          shop.video_output === undefined || shop.video_output === null) {
        message.error(`「${shop.shop_name}」的达人邀约数量、有效建联数量、寄样达人数、产出视频数均为必填项`);
        return;
      }
    }
    setEditSubmitting(true);
    try {
      const payload = {
        report_type: viewingReport.report_type,
        report_date: values.report_date?.format('YYYY-MM-DD') || viewingReport.report_date,
        stats_by_shop: editShopStatsList.map(s => ({
          shop_id: s.shop_id,
          shop_name: s.shop_name,
          invite_count: s.invite_count || 0,
          contact_count: s.contact_count || 0,
          sample_sent: s.sample_sent || 0,
          video_output: s.video_output || 0,
          analysis_summary: s.analysis_summary || '',
        })),
        summary: values.summary || '',
        plan: '',
        issues: values.issues || '',
        needs: values.needs || '',
      };
      const res = await api.post('/influencer-reports', payload);
      if (res.data.feishu_synced) {
        message.success('汇报已更新，已同步到飞书群');
      } else {
        message.warning('汇报已更新，但飞书同步失败：' + (res.data.feishu_error || '请检查飞书配置'));
      }
      setIsEditingReport(false);
      setViewingReport(null);
      loadReports();
    } catch (e: any) {
      message.error(e.response?.data?.error || '保存失败');
    } finally {
      setEditSubmitting(false);
    }
  };

  const columns = [
    {
      title: '店铺',
      key: 'shop_info',
      width: 140,
      render: (_: any, r: any) => (
        <div style={{ lineHeight: 1.5 }}>
          {r.contact_date ? (
            <div style={{ fontSize: 13, color: '#389e0d', fontWeight: 700, marginBottom: 4, background: 'linear-gradient(135deg, #f6ffed, #d9f7be)', padding: '3px 8px', borderRadius: 6, display: 'inline-block', border: '1px solid #b7eb8f' }}>
              <CalendarOutlined style={{ marginRight: 4 }} />
              {r.contact_date}
            </div>
          ) : (
            <div style={{ height: 28 }} /> // 占位保持对齐
          )}
          {r.shop_name ? (
            <Tag style={{ margin: 0, ...getShopStyle(r.shop_name), border: `1px solid ${getShopStyle(r.shop_name).border}` }}>{r.shop_name}</Tag>
          ) : (
            <span style={{ color: '#ccc', fontSize: 12 }}>-</span>
          )}
        </div>
      ),
    },
    {
      title: '达人ID',
      dataIndex: 'influencer_id',
      width: 140,
      render: (v: string) => v ? (
        <a
          href={`https://www.tiktok.com/@${v}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontWeight: 700, color: '#000', fontSize: 13, textDecoration: 'none' }}
        >
          {v}
        </a>
      ) : <span style={{ color: '#ccc' }}>-</span>,
    },
    {
      title: '建联进度',
      dataIndex: 'status',
      width: 110,
      render: (v: string, r: any) => {
        const current = PROGRESS_OPTIONS.find(o => o.value === (v || '未回复')) || PROGRESS_OPTIONS[0];
        return (
          <Dropdown
            menu={{
              items: PROGRESS_OPTIONS.map(o => ({
                key: o.value,
                label: (
                  <Tag color={o.color} style={{ margin: 0 }}>{o.label}</Tag>
                ),
              })),
              onClick: ({ key }) => handleProgressChange(r.id, key),
            }}
            trigger={['click']}
          >
            <Tag
              style={{ cursor: 'pointer', margin: 0 }}
              color={current.color}
            >
              {current.label}
            </Tag>
          </Dropdown>
        );
      },
    },
    {
      title: '建联方式',
      key: 'contact',
      width: 130,
      render: (_: any, r: any) => (
        <div style={{ lineHeight: 1.6 }}>
          <div>{r.contact_channel || '-'}</div>
          {r.contact_info && <div style={{ color: '#999', fontSize: 12 }}>{r.contact_info}</div>}
        </div>
      ),
    },
    {
      title: '合作方式',
      key: 'coop',
      width: 130,
      render: (_: any, r: any) => (
        <div style={{ lineHeight: 1.6 }}>
          <div>{r.cooperation_type ? <Tag color="blue">{r.cooperation_type}</Tag> : <span style={{ color: '#ccc' }}>-</span>}</div>
          {r.commission_rate > 0 && (
            <div style={{ color: '#fa8c16', fontSize: 12, fontWeight: 600 }}>
              佣金 {r.commission_rate}%
            </div>
          )}
        </div>
      ),
    },
    {
      title: '样品/数量',
      key: 'sample',
      width: 140,
      render: (_: any, r: any) => (
        <div style={{ lineHeight: 1.6 }}>
          <div>{r.product_name ? `${r.product_name}×${r.sample_qty || 1}` : '-'}</div>
          <div style={{ color: BRAND_COLOR, fontWeight: 600, fontSize: 12 }}>
            RM{(r.sample_cost || 0).toFixed(2)}
          </div>
        </div>
      ),
    },
    {
      title: '寄样/收货日期',
      key: 'dates',
      width: 140,
      render: (_: any, r: any) => (
        <div style={{ lineHeight: 1.6 }}>
          {r.send_date ? (
            <div style={{ color: '#52c41a', fontWeight: 600, fontSize: 12 }}>寄：{r.send_date}</div>
          ) : (
            <div style={{ color: '#faad14', fontSize: 12 }}>未寄样</div>
          )}
          {r.receive_date ? (
            <div style={{ color: '#52c41a', fontWeight: 600, fontSize: 12 }}>收：{r.receive_date}</div>
          ) : (
            <div style={{ color: '#ff4d4f', fontSize: 12 }}>未收货</div>
          )}
        </div>
      ),
    },
    {
      title: '素材排期',
      dataIndex: 'material_schedule',
      width: 100,
      render: (v: string) => v ? <span style={{ color: '#52c41a', fontWeight: 600 }}>{v}</span> : <span style={{ color: '#ccc' }}>-</span>,
    },
    {
      title: '素材链接',
      dataIndex: 'material_url',
      width: 140,
      render: (v: string) => {
        // 兼容旧数据：单字符串转数组
        let urls: string[] = [];
        try {
          if (v) {
            const parsed = JSON.parse(v);
            urls = Array.isArray(parsed) ? parsed : [v];
          }
        } catch {
          urls = v ? [v] : [];
        }
        if (urls.length === 0) return <span style={{ color: '#ccc' }}>-</span>;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {urls.map((url, idx) => (
              <Tooltip key={idx} title={url}>
                <a href={url} target="_blank" rel="noopener noreferrer"
                  style={{ color: BRAND_COLOR, fontSize: 12 }}>
                  <LinkOutlined /> 素材{urls.length > 1 ? ` ${idx + 1}` : ''}
                </a>
              </Tooltip>
            ))}
          </div>
        );
      },
    },
    {
      title: '备注',
      dataIndex: 'remark',
      width: 150,
      ellipsis: true,
      render: (v: string) => v || <span style={{ color: '#ccc' }}>-</span>,
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right' as const,
      render: (_: any, r: any) => (
        <Space size="small">
          {canEdit && (
            <>
              <Button size="small" icon={<EditOutlined />} onClick={() => openModal(r)}>编辑</Button>
              <Popconfirm title="确认删除此达人？" onConfirm={() => handleDelete(r.id)}>
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '20px 24px', background: '#f5f3f0', minHeight: '100%' }}>
      {/* 页面标题 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 18,
        }}>
          <UserOutlined />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1e293b' }}>达人BD</h2>
          <span style={{ fontSize: 12, color: '#999' }}>达人信息管理 · 建联跟进 · 日报/周报汇报</span>
        </div>
      </div>

      {/* Header Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space size="small">
          <Button icon={<FileTextOutlined />} onClick={() => openReportModal('daily')}
            style={{ borderColor: '#2563eb', color: '#2563eb' }}>提交日报</Button>
          <Button icon={<FileTextOutlined />} onClick={() => openReportModal('weekly')}
            style={{ borderColor: '#2563eb', color: '#2563eb' }}>提交周报</Button>
          <Button icon={<HistoryOutlined />} onClick={openReportHistory}
            style={{ borderColor: '#999', color: '#666' }}>汇报历史</Button>
        </Space>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData}>刷新</Button>
          {canEdit && (
            <Upload accept=".csv,.xlsx" showUploadList={false} beforeUpload={handleImport}>
              <Button icon={<UploadOutlined />}>批量导入</Button>
            </Upload>
          )}
          <ExportButton onExport={handleExport}>导出报表</ExportButton>
          {canEdit && <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>新增达人</Button>}
        </Space>
      </div>

      {/* Filters */}
      <div style={{ padding: '12px 16px', background: '#faf9f7', borderRadius: 10, marginBottom: 16, border: '1px solid #e8e5e0' }}>
        <Space wrap>
          <Input
            placeholder="搜索达人ID、店铺、合作方式"
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            onPressEnter={handleSearch}
            style={{ width: 240 }}
            allowClear
          />
          <Select
            placeholder="全部店铺"
            value={shopFilter}
            onChange={v => setShopFilter(v)}
            style={{ width: 150 }}
            allowClear
          >
            {shops.map(s => <Select.Option key={s.id} value={s.id}>{s.name}</Select.Option>)}
          </Select>
          <Select
            placeholder="全部合作方式"
            value={coopFilter}
            onChange={v => setCoopFilter(v)}
            style={{ width: 130 }}
            allowClear
          >
            {COOPERATION_TYPES.map(t => <Select.Option key={t.value} value={t.value}>{t.label}</Select.Option>)}
          </Select>
          <DatePicker.RangePicker
            placeholder={['建联日期开始', '建联日期结束']}
            value={dateRange as any}
            onChange={(dates) => setDateRange(dates as [dayjs.Dayjs | null, dayjs.Dayjs | null])}
            format='YYYY-MM-DD'
            style={{ width: 260 }}
            allowClear
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>搜索</Button>
        </Space>
      </div>

      {/* Main Table */}
      <Card styles={{ body: { padding: 0 } }}>
        <DataTable
          dataSource={store.influencers}
          columns={columns}
          loading={store.loading}
          scroll={{ x: 1300 }}
          serverPagination={{
            current: store.page,
            total: store.total,
            onChange: p => store.setPage(p),
          }}
          style={{ padding: '0 4px' }}
        />
      </Card>

      {/* Create / Edit Modal */}
      <Modal
        title={editingRecord ? `编辑达人 - ${editingRecord.influencer_id || ''}` : '新增达人'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        okText="保存"
        footer={canEdit ? undefined : <Button onClick={() => setModalOpen(false)}>关闭</Button>}
        width={640}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          {/* 基础信息 */}
          <div style={{ fontWeight: 600, color: '#333', marginBottom: 8, marginTop: 4 }}>基础信息</div>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="shop_id" label="店铺">
                <Select allowClear placeholder="选择店铺" showSearch optionFilterProp="label">
                  {shops.map(s => <Select.Option key={s.id} value={s.id} label={s.name}>{s.name}</Select.Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="influencer_id" label="达人ID" rules={[{ required: true, message: '达人ID必填' }]}>
                <Input placeholder="达人唯一标识" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="profile_url" label="达人主页链接">
            <Input placeholder="TikTok达人主页链接" />
          </Form.Item>

          {/* 建联信息 */}
          <div style={{ fontWeight: 600, color: '#333', marginBottom: 8 }}>建联信息</div>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="contact_channel" label="建联渠道">
                <Select allowClear placeholder="选择建联渠道" options={CONTACT_CHANNELS} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="contact_info" label="联系信息">
                <Input placeholder="WhatsApp号码、邮箱等" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="status" label="建联进度" initialValue="未回复">
            <Select placeholder="选择当前进度" options={PROGRESS_OPTIONS.map(o => ({ value: o.value, label: o.label }))} />
          </Form.Item>

          {/* 合作信息 */}
          <div style={{ fontWeight: 600, color: '#333', marginBottom: 8 }}>合作信息</div>
          <Form.Item name="cooperation_type" label="合作方式">
            <Select allowClear placeholder="选择合作方式" options={COOPERATION_TYPES} />
          </Form.Item>
          <Form.Item name="commission_rate" label="佣金比例">
            <InputNumber
              min={0}
              max={100}
              precision={2}
              step={0.5}
              suffix="%"
              style={{ width: 200 }}
              placeholder="输入佣金比例"
              formatter={value => `${value}`}
              parser={value => value?.replace('%', '') as any}
            />
          </Form.Item>

          {/* 样品信息 */}
          <div style={{ fontWeight: 600, color: '#333', marginBottom: 8 }}>样品信息</div>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="product_id" label="样品名称">
                <Select
                  allowClear
                  placeholder="选择产品（自动带出采购成本）"
                  showSearch
                  optionFilterProp="label"
                  options={products.map(p => ({ value: p.id, label: `${p.sku} - ${p.name}`, cost: p.cost_price }))}
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="sample_qty" label="样品数量" initialValue={1}>
                <InputNumber min={1} style={{ width: '100%' }} placeholder="数量" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="样品成本（只读）">
                <Input readOnly value={`RM${calcCost()}`} style={{ color: BRAND_COLOR, fontWeight: 600 }} />
              </Form.Item>
            </Col>
          </Row>

          {/* 时间信息 */}
          <div style={{ fontWeight: 600, color: '#333', marginBottom: 8 }}>时间信息</div>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="contact_date" label="建联日期">
                <DatePicker style={{ width: '100%' }} placeholder="选择建联日期" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="send_date" label="寄样日期">
                <DatePicker style={{ width: '100%' }} placeholder="选择寄样日期" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="receive_date" label="收货日期">
                <DatePicker style={{ width: '100%' }} placeholder="选择收货日期（可选）" />
              </Form.Item>
            </Col>
          </Row>

          {/* 素材信息 */}
          <div style={{ fontWeight: 600, color: '#333', marginBottom: 8 }}>素材信息</div>
          <Form.Item name="material_schedule" label="素材排期">
            <DatePicker style={{ width: '100%' }} placeholder="素材计划发布日期" />
          </Form.Item>
          <div style={{ marginBottom: 4, fontSize: 13, color: '#333' }}>素材链接</div>
              {materialUrls.map((url, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                  <Input
                    placeholder={`素材链接 ${idx + 1}`}
                    value={url}
                    onChange={(e) => {
                      const newUrls = [...materialUrls];
                      newUrls[idx] = e.target.value;
                      setMaterialUrls(newUrls);
                    }}
                    style={{ flex: 1 }}
                  />
                  {materialUrls.length > 1 && (
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => setMaterialUrls(materialUrls.filter((_, i) => i !== idx))}
                    />
                  )}
                  {idx === materialUrls.length - 1 && (
                    <Button
                      type="dashed"
                      icon={<PlusOutlined />}
                      onClick={() => setMaterialUrls([...materialUrls, ''])}
                    >
                      添加
                    </Button>
                  )}
                </div>
              ))}
              {materialUrls.length === 0 && (
                <Button type="dashed" icon={<PlusOutlined />} onClick={() => setMaterialUrls([''])}
                  style={{ width: '100%', borderStyle: 'dashed' }}>
                  添加素材链接
                </Button>
              )}

          {/* 其他 */}
          <div style={{ fontWeight: 600, color: '#333', marginBottom: 8 }}>其他</div>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={3} placeholder="合作细节记录" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Import loading modal */}
      <Modal title="批量导入" open={importModalOpen} footer={null} closable={false}>
        <div style={{ textAlign: 'center', padding: 20 }}>
          <p style={{ color: '#666' }}>正在解析并导入数据...</p>
        </div>
      </Modal>

      {/* 汇报提交弹窗（多店铺统计） */}
      <Modal
        title={
          <span>
            <FileTextOutlined style={{ color: BRAND_COLOR, marginRight: 8 }} />
            {reportType === 'daily' ? '达人BD日报' : '达人BD周报'}
          </span>
        }
        open={reportModalOpen}
        onCancel={() => setReportModalOpen(false)}
        onOk={() => reportForm.submit()}
        okText={reportType === 'daily' ? '提交日报' : '提交周报'}
        confirmLoading={reportSubmitting}
        width={820}
        destroyOnClose
      >
        <Form form={reportForm} layout="vertical" onFinish={handleReportSubmit}>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="report_date" label="汇报日期" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} defaultValue={dayjs()} />
              </Form.Item>
            </Col>
          </Row>

          {/* 各店铺数据统计表 */}
          <div style={{
            fontWeight: 600, color: '#333', marginBottom: 12,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span>📊 各店铺数据统计</span>
          </div>

          {shopStatsList.length > 0 ? (
            <div>
              {shopStatsList.map((shop, idx) => (
                <Card
                  key={shop.shop_id || idx}
                  size="small"
                  title={
                    <Space>
                      <Tag color="blue">{shop.shop_name}</Tag>
                      <span style={{ color: '#999', fontSize: 12 }}>（自动预填今日数据，可手动修改）</span>
                    </Space>
                  }
                  style={{ marginBottom: 10, border: '1px solid #d9d9d9' }}
                >
                  <Row gutter={[16, 12]}>
                    <Col span={6}>
                      <div style={{ fontSize: 12, color: '#666', marginBottom: 2 }}><span style={{ color: '#ff4d4f', marginRight: 3 }}>*</span>达人邀约数量</div>
                      <InputNumber
                        min={0}
                        value={shop.invite_count || 0}
                        onChange={v => updateShopStat(shop.shop_id, 'invite_count', v)}
                        style={{ width: '100%' }}
                      />
                    </Col>
                    <Col span={6}>
                      <div style={{ fontSize: 12, color: '#666', marginBottom: 2 }}><span style={{ color: '#ff4d4f', marginRight: 3 }}>*</span>有效建联数量</div>
                      <InputNumber
                        min={0}
                        value={shop.contact_count || 0}
                        onChange={v => updateShopStat(shop.shop_id, 'contact_count', v)}
                        style={{ width: '100%' }}
                      />
                    </Col>
                    <Col span={6}>
                      <div style={{ fontSize: 12, color: '#666', marginBottom: 2 }}><span style={{ color: '#ff4d4f', marginRight: 3 }}>*</span>寄样达人数</div>
                      <InputNumber
                        min={0}
                        value={shop.sample_sent || 0}
                        onChange={v => updateShopStat(shop.shop_id, 'sample_sent', v)}
                        style={{ width: '100%' }}
                      />
                    </Col>
                    <Col span={6}>
                      <div style={{ fontSize: 12, color: '#666', marginBottom: 2 }}><span style={{ color: '#ff4d4f', marginRight: 3 }}>*</span>产出视频数</div>
                      <InputNumber
                        min={0}
                        value={shop.video_output || 0}
                        onChange={v => updateShopStat(shop.shop_id, 'video_output', v)}
                        style={{ width: '100%' }}
                      />
                    </Col>
                  </Row>
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 12, color: '#666', marginBottom: 2 }}>当天寄样达人分析总结</div>
                    <Input.TextArea
                      rows={2}
                      placeholder={`${shop.shop_name} 店铺的寄样达人情况分析...`}
                      value={shop.analysis_summary || ''}
                      onChange={e => updateShopStat(shop.shop_id, 'analysis_summary', e.target.value)}
                    />
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 20, color: '#999' }}>
              暂无店铺数据，请先在店铺管理中添加店铺
            </div>
          )}

          {/* 整体总结 & 计划 */}
          <div style={{ marginTop: 16 }}>
            <Form.Item name="summary" label="整体工作总结">
              <Input.TextArea
                rows={3}
                placeholder={reportType === 'daily'
                  ? '今日工作的整体总结、重点成果、关键发现...'
                  : '本周工作的整体总结、重点成果、关键发现...'}
              />
            </Form.Item>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="issues" label="遇到的问题">
                  <Input.TextArea rows={2} placeholder="遇到的困难或阻碍..." />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="needs" label="需要支持">
                  <Input.TextArea rows={2} placeholder="需要什么支持？" />
                </Form.Item>
              </Col>
            </Row>
          </div>
        </Form>
      </Modal>

    {/* 汇报历史弹窗（展示各店铺数据） */}
      <Modal
        title={
          <span>
            <HistoryOutlined style={{ color: BRAND_COLOR, marginRight: 8 }} />
            达人BD汇报历史
          </span>
        }
        open={reportHistoryOpen}
        onCancel={() => setReportHistoryOpen(false)}
        footer={null}
        width={850}
      >
        {!feishuUrl && (
          <div style={{
            background: '#fff7e6', border: '1px solid #ffd591', borderRadius: 6,
            padding: '8px 12px', marginBottom: 12, fontSize: 13, color: '#ad6800',
          }}>
            ⚠️ 尚未配置飞书群 Webhook，请先在「系统设置」中配置飞书群机器人。
          </div>
        )}
        <Tabs
          defaultActiveKey="daily"
          onChange={(key) => loadReports(key)}
          items={[
            {
              key: 'daily',
              label: '日报',
              children: renderReportList(),
            },
            {
              key: 'weekly',
              label: '周报',
              children: renderReportList(),
            },
          ]}
        />
      </Modal>

    {/* 汇报详情弹窗（查看/编辑双模式） */}
      <Modal
        title={
          <Space>
            <FileTextOutlined style={{ color: BRAND_COLOR }} />
            <span>
              {isEditingReport ? `编辑${viewingReport?.report_type === 'daily' ? '日报' : '周报'} - ${viewingReport?.report_date}` : `${viewingReport?.report_type === 'daily' ? '日报' : '周报'}详情 - ${viewingReport?.report_date}`}
            </span>
          </Space>
        }
        open={!!viewingReport}
        onCancel={() => { setIsEditingReport(false); setViewingReport(null); }}
        footer={
          isEditingReport ? (
            <Space>
              <Button onClick={() => setIsEditingReport(false)}>取消</Button>
              <Button type="primary" onClick={() => reportDetailForm.submit()} loading={editSubmitting}>保存修改</Button>
            </Space>
          ) : (
            <Space>
              <Button onClick={() => setViewingReport(null)}>关闭</Button>
              <Button type="primary" icon={<EditOutlined />} onClick={enterEditReport}>编辑</Button>
            </Space>
          )
        }
        width={850}
        destroyOnClose
      >
        {!isEditingReport && viewingReport ? (
          // ========== 查看模式 ==========
          (() => {
            const shopData = (() => { try { return JSON.parse(viewingReport.stats_by_shop || '[]'); } catch { return []; } })();
            const totalInvite = shopData.reduce((s: number, x: any) => s + (x.invite_count || 0), 0);
            const totalContact = shopData.reduce((s: number, x: any) => s + (x.contact_count || 0), 0);
            const totalSample = shopData.reduce((s: number, x: any) => s + (x.sample_sent || 0), 0);
            const totalVideo = shopData.reduce((s: number, x: any) => s + (x.video_output || 0), 0);

            return (
              <div>
                <Card size="small" style={{ marginBottom: 16, background: '#f6f8fa' }}>
                  <Row gutter={24}>
                    <Col span={6}><Statistic title="达人邀约" value={totalInvite} /></Col>
                    <Col span={6}><Statistic title="有效建联" value={totalContact} /></Col>
                    <Col span={6}><Statistic title="寄样达人数" value={totalSample} /></Col>
                    <Col span={6}><Statistic title="产出视频" value={totalVideo} /></Col>
                  </Row>
                </Card>

                <div style={{ fontWeight: 600, marginBottom: 8 }}>📊 各店铺数据明细</div>
                {shopData.length > 0 ? (
                  shopData.map((s: any) => (
                    <Card key={s.shop_id} size="small" style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <Tag color="blue" style={{ fontSize: 14 }}>{s.shop_name}</Tag>
                        <Space>
                          邀约 <b>{s.invite_count || 0}</b> | 建联 <b>{s.contact_count || 0}</b> | 寄样 <b>{s.sample_sent || 0}</b> | 视频 <b>{s.video_output || 0}</b>
                        </Space>
                      </div>
                      {s.analysis_summary && (
                        <div style={{ background: '#f9f9f9', padding: '8px 12px', borderRadius: 6, fontSize: 13, color: '#555' }}>
                          📋 分析总结：{s.analysis_summary}
                        </div>
                      )}
                    </Card>
                  ))
                ) : (
                  <div style={{ color: '#999', textAlign: 'center', padding: 20 }}>暂无店铺数据</div>
                )}

                {viewingReport.summary && (
                  <>
                    <div style={{ fontWeight: 600, marginTop: 16, marginBottom: 8 }}>📝 整体工作总结</div>
                    <div style={{ background: '#f6ffed', border: '1px solid #b7eb8f', padding: '12px 16px', borderRadius: 8, whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.8 }}>
                      {viewingReport.summary}
                    </div>
                  </>
                )}

                {(viewingReport.issues || viewingReport.needs) && (
                  <>
                    <div style={{ fontWeight: 600, marginTop: 16, marginBottom: 8 }}>其他</div>
                    {viewingReport.issues && (
                      <div style={{ marginBottom: 8 }}>
                        <Tag color="warning">⚠️ 遇到的问题</Tag>
                        <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, padding: '8px 0' }}>{viewingReport.issues}</div>
                      </div>
                    )}
                    {viewingReport.needs && (
                      <div>
                        <Tag color="processing">🔧 需要支持</Tag>
                        <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, padding: '8px 0' }}>{viewingReport.needs}</div>
                      </div>
                    )}
                  </>
                )}

                <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #f0f0f0', fontSize: 12, color: '#999', textAlign: 'right' }}>
                  提交时间：{new Date(viewingReport.created_at).toLocaleString('zh-CN')}
                </div>
              </div>
            );
          })()
        ) : isEditingReport && viewingReport ? (
          // ========== 编辑模式 ==========
          <Form form={reportDetailForm} layout="vertical" onFinish={handleSaveEdit}>
            <Form.Item name="report_date" label="汇报日期" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>

            <div style={{ fontWeight: 600, marginBottom: 12 }}>📊 各店铺数据统计</div>
            {editShopStatsList.length > 0 ? (
              editShopStatsList.map((shop) => (
                <Card
                  key={shop.shop_id}
                  size="small"
                  title={<Tag color="blue">{shop.shop_name}</Tag>}
                  style={{ marginBottom: 10, border: '1px solid #d9d9d9' }}
                >
                  <Row gutter={[16, 12]}>
                    <Col span={6}>
                      <div style={{ fontSize: 12, color: '#666', marginBottom: 2 }}><span style={{ color: '#ff4d4f', marginRight: 3 }}>*</span>达人邀约数量</div>
                      <InputNumber min={0} value={shop.invite_count || 0}
                        onChange={v => updateEditShopStat(shop.shop_id, 'invite_count', v)} style={{ width: '100%' }} />
                    </Col>
                    <Col span={6}>
                      <div style={{ fontSize: 12, color: '#666', marginBottom: 2 }}><span style={{ color: '#ff4d4f', marginRight: 3 }}>*</span>有效建联数量</div>
                      <InputNumber min={0} value={shop.contact_count || 0}
                        onChange={v => updateEditShopStat(shop.shop_id, 'contact_count', v)} style={{ width: '100%' }} />
                    </Col>
                    <Col span={6}>
                      <div style={{ fontSize: 12, color: '#666', marginBottom: 2 }}><span style={{ color: '#ff4d4f', marginRight: 3 }}>*</span>寄样达人数</div>
                      <InputNumber min={0} value={shop.sample_sent || 0}
                        onChange={v => updateEditShopStat(shop.shop_id, 'sample_sent', v)} style={{ width: '100%' }} />
                    </Col>
                    <Col span={6}>
                      <div style={{ fontSize: 12, color: '#666', marginBottom: 2 }}><span style={{ color: '#ff4d4f', marginRight: 3 }}>*</span>产出视频数</div>
                      <InputNumber min={0} value={shop.video_output || 0}
                        onChange={v => updateEditShopStat(shop.shop_id, 'video_output', v)} style={{ width: '100%' }} />
                    </Col>
                  </Row>
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 12, color: '#666', marginBottom: 2 }}>分析总结</div>
                    <Input.TextArea rows={2} placeholder={`${shop.shop_name} 店铺的寄样达人情况分析...`}
                      value={shop.analysis_summary || ''}
                      onChange={e => updateEditShopStat(shop.shop_id, 'analysis_summary', e.target.value)} />
                  </div>
                </Card>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: 20, color: '#999' }}>暂无店铺数据</div>
            )}

            <div style={{ marginTop: 16 }}>
              <Form.Item name="summary" label="整体工作总结">
                <Input.TextArea rows={4} placeholder="整体工作总结、重点成果..." />
              </Form.Item>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="issues" label="遇到的问题">
                    <Input.TextArea rows={2} placeholder="遇到的困难或阻碍..." />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="needs" label="需要支持">
                    <Input.TextArea rows={2} placeholder="需要什么支持？" />
                  </Form.Item>
                </Col>
              </Row>
            </div>
          </Form>
        ) : null}
      </Modal>

    </div>
  );

  // 渲染汇报列表（各店铺数据）
  function renderReportList() {
    // 解析 stats_by_shop JSON 并计算合计
    const parseShopStats = (r: any) => {
      try { return JSON.parse(r.stats_by_shop || '[]'); } catch { return []; }
    };

    return (
      <List
        dataSource={reports}
        locale={{ emptyText: '暂无记录' }}
        renderItem={(r: any) => {
          const shopData = parseShopStats(r);
          const totalInvite = shopData.reduce((s: number, x: any) => s + (x.invite_count || 0), 0);
          const totalContact = shopData.reduce((s: number, x: any) => s + (x.contact_count || 0), 0);
          const totalSample = shopData.reduce((s: number, x: any) => s + (x.sample_sent || 0), 0);
          const totalVideo = shopData.reduce((s: number, x: any) => s + (x.video_output || 0), 0);

          return (
            <List.Item
              extra={
                <Space direction="vertical" align="end">
                  <Space>
                    <Badge status={r.feishu_synced ? 'success' : 'error'} text={r.feishu_synced ? '已同步飞书' : '未同步'} />
                    <Button size="small" onClick={() => setViewingReport(r)}>查看详情</Button>
                    {!r.feishu_synced && feishuUrl && (
                      <Button size="small" icon={<SendOutlined />} onClick={() => resendToFeishu(r.id)}>重推</Button>
                    )}
                  </Space>
                  <div style={{ fontSize: 11, color: '#bbb' }}>
                    合计：邀约{totalInvite} 建联{totalContact} 寄样{totalSample} 视频{totalVideo}
                  </div>
                </Space>
              }
            >
              <List.Item.Meta
                title={
                  <span>
                    <Tag color={r.report_type === 'daily' ? 'blue' : 'green'}>{r.report_type === 'daily' ? '日报' : '周报'}</Tag>
                    {r.report_date}
                    {r.display_name && <Tag style={{ marginLeft: 6, fontSize: 11 }} color="default">{r.display_name}</Tag>}
                  </span>
                }
                description={
                  <div>
                    {/* 各店铺明细 */}
                    {shopData.length > 0 && (
                      <div style={{ marginBottom: 6 }}>
                        {shopData.map((s: any) => (
                          <Tag key={s.shop_id} style={{ margin: '0 2px 2px 0' }} color="processing">
                            {s.shop_name}: 邀{s.invite_count || 0} 联{s.contact_count || 0} 样{s.sample_sent || 0} 视{s.video_output || 0}
                          </Tag>
                        ))}
                      </div>
                    )}
                    {r.summary && <div style={{ color: '#666', fontSize: 12 }}>{r.summary.slice(0, 100)}{(r.summary.length > 100 ? '...' : '')}</div>}
                  </div>
                }
              />
            </List.Item>
          );
        }}
      />
    );
  }
}

