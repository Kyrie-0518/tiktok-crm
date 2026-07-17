import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  Card, Table, Button, Modal, InputNumber, Select, Space, Popconfirm, message,
  Row, Col, Statistic, Input, Divider, Form, Tag, Tabs, DatePicker, Spin
} from 'antd';
import {
  PlusOutlined, DeleteOutlined,
  SettingOutlined, CalculatorOutlined, FunctionOutlined, HolderOutlined,
  CheckCircleOutlined, CloseCircleOutlined, SyncOutlined,
  DollarOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import * as echarts from 'echarts';
import { useFinanceStore, FormulaItem, evaluateFormulaFrontend } from '../stores/financeStore';
import { useProductStore } from '../stores/productStore';
import api from '../api';
import { useHasPerm } from '../stores/authStore';
import DataTable from '../components/DataTable';
import ExportButton from '../components/ExportButton';

const BRAND = '#4568FF';
const { RangePicker } = DatePicker;

export default function Finance() {
  const canEdit = useHasPerm('finance', 'edit');
  const fs = useFinanceStore();
  const ps = useProductStore();
  const [activeTab, setActiveTab] = useState<string>('product');
  const [productFilter, setProductFilter] = useState<number | undefined>();
  const [syncing, setSyncing] = useState(false);
  // Record modal
  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [costFormulas, setCostFormulas] = useState<Record<string, string>>({});
  // Cost item modal
  const [costModalOpen, setCostModalOpen] = useState(false);
  const [editingCostItem, setEditingCostItem] = useState<any>(null);
  const [costForm] = Form.useForm();
  // Formula modal
  const [formulaModalOpen, setFormulaModalOpen] = useState(false);
  const [formulaList, setFormulaList] = useState<FormulaItem[]>([]);
  const [formulaErrors, setFormulaErrors] = useState<Record<number, string>>({});
  const [globalFormulaError, setGlobalFormulaError] = useState<string>('');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  // Formula preview
  const [previewProductId, setPreviewProductId] = useState<number | undefined>();

  // Order profit state
  const [orderProfitSummary, setOrderProfitSummary] = useState<any>(null);
  const [orderProfitRecords, setOrderProfitRecords] = useState<any[]>([]);
  const [orderProfitLoading, setOrderProfitLoading] = useState(false);
  const [orderProfitTotal, setOrderProfitTotal] = useState(0);
  const [orderProfitPage, setOrderProfitPage] = useState(1);
  const [orderShopFilter, setOrderShopFilter] = useState<number | null>(null);
  const [orderDateRange, setOrderDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [orderProfitDetailModal, setOrderProfitDetailModal] = useState<any>(null);
  // Order shops list
  const [orderShops, setOrderShops] = useState<any[]>([]);

  // 利润趋势图状态
  const [trendData, setTrendData] = useState<any>(null);
  const [trendLoading, setTrendLoading] = useState(false);
  const [trendDays, setTrendDays] = useState(30);
  const trendChartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
    loadOrderShops();
  }, []);

  useEffect(() => {
    if (activeTab === 'order') {
      loadOrderProfitData();
    }
  }, [activeTab]);

  // 翻页时重新加载数据
  useEffect(() => {
    if (activeTab === 'order') {
      loadOrderProfitData();
    }
  }, [orderProfitPage]);

  // 切换到趋势tab时加载趋势数据
  useEffect(() => {
    if (activeTab === 'trend') {
      loadTrendData();
    }
  }, [activeTab, trendDays]);

  // 加载利润趋势数据
  const loadTrendData = async () => {
    setTrendLoading(true);
    try {
      const res = await api.get(`/finance/trend?days=${trendDays}`);
      setTrendData(res.data);
    } catch { message.error('加载趋势数据失败'); }
    finally { setTrendLoading(false); }
  };

  // 渲染/更新 ECharts 趋势图
  useEffect(() => {
    if (!trendData?.data || !trendChartRef.current) return;
    const dom = trendChartRef.current;
    const chart = echarts.init(dom);
    chart.setOption({
      tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
      legend: { data: ['净利润(RMB)', 'ROI'], top: 0 },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: { type: 'category', data: trendData.data.map((d: any) => d.date.slice(5)), boundaryGap: false },
      yAxis: [
        { type: 'value', name: '净利润(¥)', position: 'left' },
        { type: 'value', name: 'ROI', position: 'right' },
      ],
      series: [
        { name: '净利润(RMB)', type: 'line', smooth: true, data: trendData.data.map((d: any) => d.profit_rmb), itemStyle: { color: '#059669' }, areaStyle: { opacity: 0.15 } },
        { name: 'ROI', type: 'line', smooth: true, yAxisIndex: 1, data: trendData.data.map((d: any) => d.roi), itemStyle: { color: '#4568FF' } },
      ],
    });
    const resizeObserver = new ResizeObserver(() => chart.resize());
    resizeObserver.observe(dom);
    return () => { resizeObserver.disconnect(); chart.dispose(); };
  }, [trendData]);

  const trendTabContent = (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Statistic title="期间总营收" value={trendData?.summary?.period_revenue_myr || 0} precision={2} prefix="RM " />
        </Col>
        <Col span={6}>
          <Statistic title="期间总利润" value={trendData?.summary?.period_profit_rmb || 0} precision={2} prefix="¥ "
            valueStyle={{ color: (trendData?.summary?.period_profit_rmb || 0) >= 0 ? '#059669' : '#dc2626' }} />
        </Col>
        <Col span={6}>
          <Statistic title="日均利润" value={trendData?.summary?.period_avg_daily_profit || 0} precision={2} prefix="¥ " />
        </Col>
      </Row>

      {/* 趋势图 */}
      <Card title={`📈 利润趋势（最近${trendDays}天）`} size="small" extra={
        <Select size="small" value={trendDays} onChange={v => setTrendDays(v)}
          options={[{ value: 7, label: '7天' }, { value: 14, label: '14天' }, { value: 30, label: '30天' }, { value: 60, label: '60天' }, { value: 90, label: '90天' }]} style={{ width: 80 }} />
      }>
        {trendLoading ? <div style={{ textAlign: 'center', padding: 60 }}><Spin tip="加载中..." /></div> :
          <div ref={trendChartRef} style={{ width: '100%', height: 380 }} />}
      </Card>
    </div>
  );

  const loadData = async () => {
    fs.fetchCostItems();
    fs.fetchRecords(productFilter ? { product_id: productFilter } : undefined);
    fs.fetchSummary(productFilter ? { product_id: productFilter } : undefined);
    fs.fetchFormulas();
    fs.fetchExchangeRate();
    if (ps.products.length === 0) ps.fetchProducts();
  };

  const loadOrderShops = async () => {
    try {
      const res = await api.get('/shops');
      setOrderShops(res.data);
    } catch {}
  };

  const loadOrderProfitData = async () => {
    setOrderProfitLoading(true);
    try {
      const params: any = {};
      if (orderShopFilter) params.shop_id = orderShopFilter;
      if (orderDateRange) {
        params.date_from = orderDateRange[0].format('YYYY-MM-DD');
        params.date_to = orderDateRange[1].format('YYYY-MM-DD');
      }
      const [summaryRes, recordsRes] = await Promise.all([
        api.get('/finance/order-profit/summary', { params }),
        api.get('/finance/order-profit/records', { params: { ...params, page: orderProfitPage, page_size: 20 } }),
      ]);
      setOrderProfitSummary(summaryRes.data);
      setOrderProfitRecords(recordsRes.data.records);
      setOrderProfitTotal(recordsRes.data.total);
    } catch (e: any) {
      message.error(e.response?.data?.error || '加载订单利润数据失败');
    } finally {
      setOrderProfitLoading(false);
    }
  };

  const handleFilter = () => {
    fs.fetchRecords(productFilter ? { product_id: productFilter } : undefined);
    fs.fetchSummary(productFilter ? { product_id: productFilter } : undefined);
  };

  // ============ Sync Products ============

  const handleSyncProducts = async () => {
    setSyncing(true);
    try {
      const result = await fs.syncProducts();
      message.success(`同步成功，共 ${result.total_products} 个产品，新增 ${result.added} 条核算记录`);
    } catch (e: any) {
      const errMsg = e.response?.data?.error || e.message || '同步失败，请检查服务端控制台日志';
      message.error(errMsg, 5);
    } finally {
      setSyncing(false);
    }
  };

  // ============ Record CRUD ============

  // Open global formula config modal
  const openCreateRecordModal = () => {
    const formulas: Record<string, string> = {};
    for (const ci of fs.costItems) {
      if (ci.formula) formulas[ci.id] = ci.formula;
    }
    setCostFormulas(formulas);
    setRecordModalOpen(true);
  };

  const handleRecordSubmit = async () => {
    try {
      // Save global formulas to cost_items, then batch apply to all records
      for (const ci of fs.costItems) {
        if (costFormulas[ci.id] !== undefined) {
          await fs.updateCostItem(ci.id, { formula: costFormulas[ci.id] });
        }
      }
      const updated = await fs.batchApplyFormulas(costFormulas);
      setRecordModalOpen(false);
      loadData();
      message.success(`全局公式已应用，共影响 ${updated} 条核算记录`);
    } catch (e: any) {
      message.error(e.response?.data?.error || '操作失败');
    }
  };

  // ============ Cost Item CRUD ============

  const openCostModal = (item?: any) => {
    if (item) {
      setEditingCostItem(item);
      costForm.setFieldsValue({ name: item.name, currency: item.currency, value_format: item.value_format || 'number', formula: item.formula || '' });
    } else {
      setEditingCostItem(null);
      costForm.resetFields();
    }
    setCostModalOpen(true);
  };

  const handleCostSubmit = async () => {
    try {
      const values = await costForm.validateFields();
      if (editingCostItem) {
        await fs.updateCostItem(editingCostItem.id, values);
      } else {
        await fs.createCostItem(values);
      }
      setCostModalOpen(false);
      loadData();
      message.success('操作成功');
    } catch (e: any) {
      if (!e.errorFields) message.error(e.response?.data?.error || '操作失败');
    }
  };

  // ============ Formula Config (Drag & Drop) ============

  const openFormulaModal = () => {
    setFormulaList(JSON.parse(JSON.stringify(fs.formulas)));
    setFormulaErrors({});
    setGlobalFormulaError('');
    // Default preview product: first record with product data
    setPreviewProductId(fs.records[0]?.product_id);
    setFormulaModalOpen(true);
  };

  const addFormula = () => {
    const maxOrder = formulaList.reduce((max, f) => Math.max(max, f.sort_order), 0);
    setFormulaList([...formulaList, {
      name: '', expression: '', format: 'number' as const, currency: 'MYR', sort_order: maxOrder + 1,
    }]);
  };

  const removeFormula = (index: number) => {
    const newList = formulaList.filter((_, i) => i !== index);
    newList.forEach((f, i) => { f.sort_order = i + 1; });
    setFormulaList(newList);
    setFormulaErrors({});
    setGlobalFormulaError('');
  };

  const updateFormula = (index: number, field: keyof FormulaItem, value: any) => {
    const newList = [...formulaList];
    newList[index] = { ...newList[index], [field]: value };
    if (field === 'sort_order') {
      const order = Number(value);
      if (order < 1 || order > 99 || isNaN(order)) return;
    }
    setFormulaList(newList);
    setGlobalFormulaError('');
  };

  const handleDragStart = (index: number) => { setDragIndex(index); };
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    const newList = [...formulaList];
    const [moved] = newList.splice(dragIndex, 1);
    newList.splice(index, 0, moved);
    newList.forEach((f, i) => { f.sort_order = i + 1; });
    setFormulaList(newList);
    setDragIndex(index);
  };
  const handleDragEnd = () => { setDragIndex(null); };

  const handleValidateFormulas = () => {
    const errors: Record<number, string> = {};
    for (let i = 0; i < formulaList.length; i++) {
      const f = formulaList[i];
      if (!f.name.trim()) { errors[i] = '名称不能为空'; continue; }
      if (!f.expression.trim()) { errors[i] = '表达式不能为空'; continue; }
    }
    if (Object.keys(errors).length > 0) { setFormulaErrors(errors); return; }
    setFormulaErrors({});
    const error = fs.validateFormulas(formulaList, fs.costItems);
    if (error) { setGlobalFormulaError(error); } else { setGlobalFormulaError(''); message.success('公式校验通过'); }
  };

  const handleFormulaSave = async () => {
    const errors: Record<number, string> = {};
    for (let i = 0; i < formulaList.length; i++) {
      const f = formulaList[i];
      if (!f.name.trim()) { errors[i] = '名称不能为空'; continue; }
      if (!f.expression.trim()) { errors[i] = '表达式不能为空'; continue; }
    }
    if (Object.keys(errors).length > 0) { setFormulaErrors(errors); message.error('请完善公式信息'); return; }
    setFormulaErrors({});
    const error = fs.validateFormulas(formulaList, fs.costItems);
    if (error) { setGlobalFormulaError(error); message.error(error); return; }
    try {
      await fs.updateFormulas(formulaList);
      setFormulaModalOpen(false);
      loadData();
      message.success('公式已保存，数据已重算');
    } catch (e: any) {
      message.error(e.response?.data?.error || e.message || '保存失败', 5);
    }
  };

  // ============ Export ============

  const handleExport = async () => {
    try {
      const { data } = await api.get('/finance/records/export');
      const XLSX = await import('xlsx');
      const { records, formulas } = data;
      const rows = records.map((r: any) => {
        const row: any = { SKU: r.sku, 产品名称: r.product_name, '产品售价(MYR)': r.sell_price, '采购成本(¥)': r.cost_price };
        const sorted = [...formulas].sort((a: any, b: any) => a.sort_order - b.sort_order);
        for (const f of sorted) {
          const val = r[f.name] || 0;
          const currencyLabel = f.currency === 'USD' ? '(USD)' : f.currency === 'RMB' ? '(¥)' : f.currency === 'MYR' ? '(RM)' : '';
          row[f.name + (f.format === 'percentage' ? '' : currencyLabel)] = f.format === 'percentage' ? `${(val * 100).toFixed(2)}%` : val.toFixed(2);
        }
        fs.costItems.forEach((ci) => {
          const rawVal = r.cost_detail?.[ci.id] || 0;
          if (ci.value_format === 'percentage') {
            row[ci.name + '(%)'] = rawVal;
          } else {
            row[ci.name + (ci.currency === 'MYR' ? '(MYR)' : '')] = rawVal;
          }
        });
        return row;
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '利润核算');
      const now = new Date();
      XLSX.writeFile(wb, `MERA_利润核算_${now.toISOString().slice(0, 10)}.xlsx`);
      message.success('导出成功');
    } catch { message.error('导出失败'); }
  };

  // ============ Render helpers ============

  const numColor = (v: number) => v >= 0 ? '#52c41a' : '#ff4d4f';
  const sortedFormulas = [...fs.formulas].sort((a, b) => a.sort_order - b.sort_order);

  const formulaColumns = sortedFormulas.map(f => ({
    title: f.name, width: 100,
    render: (_: any, r: any) => {
      const val = r[f.name] || 0;
      if (f.format === 'percentage') {
        return <span style={{ color: numColor(val), fontWeight: 600 }}>{(val * 100).toFixed(2)}%</span>;
      }
      const isFinancial = ['净利润', '总投入'].includes(f.name);
      const currencySymbol = f.currency === 'USD' ? '$' : f.currency === 'RMB' ? '¥' : f.currency === 'MYR' ? 'RM' : '';
      return (
        <span style={{ color: isFinancial ? numColor(val) : '#333', fontWeight: isFinancial ? 600 : 400 }}>
          {currencySymbol}{val.toFixed(2)}
        </span>
      );
    },
  }));

  const columns = [
    {
      title: '产品图片', dataIndex: 'image', width: 70, fixed: 'left' as const,
      render: (img: string) => (
        <div style={{
          width: 48, height: 48, borderRadius: 6, overflow: 'hidden',
          background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '1px solid #e8e8e8',
        }}>
          {img ? <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ fontSize: 22 }}>&#x1F980;</span>}
        </div>
      ),
    },
    {
      title: '产品名称', width: 200,
      render: (_: any, r: any) => (
        <div>
          <div style={{ fontWeight: 500, color: '#333' }}>{r.product_name || '-'}</div>
          <div style={{ color: '#999', fontSize: 12 }}>售价 RM{(r.sell_price || 0).toFixed(2)}</div>
        </div>
      ),
    },
    {
      title: '采购成本', width: 100,
      render: (_: any, r: any) => <span>¥{(r.cost_price || 0).toFixed(2)}</span>,
    },
    ...formulaColumns,
    {
      title: '操作', width: 80, fixed: 'right' as const,
      render: (_: any, r: any) => (
        <Space>
          {canEdit && (
            <Popconfirm title="确定删除？" onConfirm={() => { fs.deleteRecord(r.id!); }}>
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const baseVariables = ['售价', '采购成本', '产品重量', 'MYR兑RMB汇率', ...fs.costItems.map(ci => ci.name)];

  // Preview calculation: memoized based on selected product + formula list + cost items + rate
  const previewData = useMemo(() => {
    if (!previewProductId) return null;
    const pr = fs.records.find(r => r.product_id === previewProductId);
    if (!pr) return null;
    return fs.previewCalculation(
      { sell_price: pr.sell_price || 0, cost_price: pr.cost_price || 0, weight: pr.weight || 0 },
      fs.costItems, formulaList, fs.exchangeRate, pr.cost_detail || {},
    );
  }, [previewProductId, fs.records, fs.costItems, formulaList, fs.exchangeRate]);

  const getFormulaVariablesUpTo = (currentIndex: number) => {
    const currentSortOrder = formulaList[currentIndex]?.sort_order || 0;
    return formulaList
      .filter((f, i) => i !== currentIndex && f.sort_order < currentSortOrder && f.name.trim())
      .map(f => f.name);
  };

  // ---- Order Profit helpers ----
  const orderProfitColumns = [
    {
      title: '订单号', dataIndex: 'order_no', width: 160,
      render: (v: string, r: any) => (
        <Button type="link" size="small" style={{ padding: 0, fontSize: 12 }} onClick={() => setOrderProfitDetailModal(r)}>
          {v}
        </Button>
      ),
    },
    { title: '店铺', dataIndex: 'shop_name', width: 120 },
    {
      title: '订单时间', dataIndex: 'order_time', width: 160,
      render: (v: string) => v ? v.slice(0, 19) : '-',
    },
    {
      title: '实付金额(MYR)', dataIndex: 'actual_amount', width: 130,
      render: (v: number) => <span style={{ color: BRAND, fontWeight: 600 }}>RM {(v || 0).toFixed(2)}</span>,
    },
    {
      title: '税费(MYR)', dataIndex: 'taxes', width: 100,
      render: (v: number) => <span style={{ color: '#999' }}>{(v || 0).toFixed(2)}</span>,
    },
    {
      title: '跨境运费(RMB)', width: 130,
      render: (_: any, r: any) => (
        <span style={{ color: '#ff4d4f' }}>
          ¥ {(r.profit_data?.c || 0).toFixed(2)}
        </span>
      ),
    },
    {
      title: '采购成本(RMB)', width: 130,
      render: (_: any, r: any) => (
        <span style={{ color: '#fa8c16', fontWeight: 600 }}>
          ¥ {(r.profit_data?.y || 0).toFixed(2)}
        </span>
      ),
    },
    {
      title: '平台费用(RMB)', width: 130,
      render: (_: any, r: any) => (
        <span style={{ color: '#ff4d4f' }}>¥ {(r.profit_data?.z || 0).toFixed(2)}</span>
      ),
    },
    {
      title: '净利润(RMB)', width: 130,
      render: (_: any, r: any) => {
        const v = r.profit_data?.net_profit || 0;
        return <span style={{ color: numColor(v), fontWeight: 700 }}>¥ {v.toFixed(2)}</span>;
      },
    },
  ];

  const summary = orderProfitSummary;
  const exchangeRate = summary?.exchange_rate || fs.exchangeRate || 1.55;

  // ---- Tab content ----
  const productTabContent = (
    <div>
      {/* ========== Summary Cards (Product) ========== */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="成交价总额" value={fs.summary.total_revenue} prefix="RM" precision={2}
              valueStyle={{ color: BRAND, fontSize: 18 }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="总净利润" value={fs.summary.total_profit} prefix="RM" precision={2}
              valueStyle={{ color: numColor(fs.summary.total_profit), fontSize: 18 }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="总投入" value={fs.summary.total_investment} prefix="RM" precision={2}
              valueStyle={{ fontSize: 18 }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="整体ROI" value={fs.summary.overall_roi} suffix="%" precision={2}
              valueStyle={{ color: numColor(fs.summary.overall_roi), fontSize: 18 }} />
          </Card>
        </Col>
      </Row>

      {/* ========== Filter & Action Bar ========== */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Select
            placeholder="按产品筛选"
            value={productFilter}
            onChange={v => setProductFilter(v)}
            style={{ width: 200 }}
            allowClear
            showSearch
            optionFilterProp="label"
            options={fs.records.map((r: any) => ({ value: r.product_id, label: `${r.sku || ''} - ${r.product_name || ''}` }))}
          />
          <Button type="primary" onClick={handleFilter}>查询</Button>
        </Space>
        <Space>
          <ExportButton onExport={handleExport}>导出报表</ExportButton>
          {canEdit && (
            <>
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreateRecordModal}
                style={{ background: BRAND, borderColor: BRAND }}>配置成本公式</Button>
              <Button icon={<SyncOutlined />} loading={syncing} onClick={handleSyncProducts}>同步产品</Button>
              <Button icon={<SettingOutlined />} onClick={() => openCostModal()}>管理成本项</Button>
              <Button icon={<FunctionOutlined />} onClick={openFormulaModal}>配置核算公式</Button>
            </>
          )}
        </Space>
      </div>

      {/* ========== Rate Display ========== */}
      <div style={{
        marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8,
        padding: '4px 10px', borderRadius: 12, background: '#f0f5ff', border: '1px solid #d6e4ff',
        fontSize: 12, color: '#666', width: 'fit-content',
      }}>
        <CalculatorOutlined style={{ color: BRAND }} />
        <span>MYR兑RMB汇率：<strong style={{ color: BRAND }}>{fs.exchangeRate}</strong></span>
        {canEdit && (
          <>
            <a onClick={async () => {
              try {
                await fs.updateExchangeRate(0);
                message.success('汇率已自动更新，数据已重算');
              } catch {
                message.error('自动获取汇率失败');
              }
            }} style={{ fontSize: 12 }}>自动获取</a>
            <a onClick={async () => {
              const val = prompt('请输入MYR兑RMB汇率：', String(fs.exchangeRate));
              if (val && !isNaN(Number(val)) && Number(val) > 0) {
                await fs.updateExchangeRate(Number(val));
                message.success('汇率已更新，数据已重算');
              }
            }} style={{ fontSize: 12 }}>手动修改</a>
          </>
        )}
      </div>

      {/* ========== Records Table ========== */}
      <Table
        dataSource={fs.records}
        columns={columns}
        rowKey="id"
        loading={fs.loading}
        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
        scroll={{ x: 800 }}
        expandable={{
          expandedRowRender: (record: any) => (
            <div style={{ padding: '8px 0' }}>
              <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>成本明细</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {fs.costItems.map(ci => {
                  const rawVal = record.cost_detail?.[ci.id] || 0;
                  const isPct = ci.value_format === 'percentage';
                  // 有公式的成本项使用公式计算结果，而非原始存储值
                  const effectiveVal = ci.formula?.trim() ? (() => {
                    try {
                      const ctx: Record<string, number> = { 售价: record.sell_price || 0, 采购成本: record.cost_price || 0, 产品重量: record.weight || 0, MYR兑RMB汇率: fs.exchangeRate || 1.55 };
                      return evaluateFormulaFrontend(ci.formula, ctx);
                    } catch { return rawVal; }
                  })() : rawVal;
                  const currencySymbol = ci.currency === 'MYR' ? 'RM' : ci.currency === 'USD' ? '$' : '¥';
                  let displayVal: string;
                  if (isPct) {
                    displayVal = `${effectiveVal}% ≈ RM${((record.sell_price || 0) * effectiveVal / 100).toFixed(2)}`;
                  } else {
                    displayVal = `${currencySymbol}${effectiveVal.toFixed(2)}`;
                  }
                  return (
                    <div key={ci.id} style={{
                      padding: '6px 10px', borderRadius: 6,
                      background: ci.currency === 'MYR' ? '#fff7e6' : isPct ? '#fff0f6' : '#f6ffed',
                      border: `1px solid ${ci.currency === 'MYR' ? '#ffd591' : isPct ? '#ffadd2' : '#b7eb8f'}`,
                    }}>
                      <div style={{ fontSize: 12, color: '#666', display: 'flex', alignItems: 'center', gap: 4 }}>
                        {ci.name}
                        {isPct && <Tag color="magenta" style={{ fontSize: 10 }}>百分比</Tag>}
                        {ci.formula?.trim() && <Tag color="green" style={{ fontSize: 10 }}>公式</Tag>}
                      </div>
                      <div style={{ fontWeight: 600, color: '#333', marginTop: 2 }}>{displayVal}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          ),
        }}
      />

      {/* ========== Global Styles ========== */}
      <style>{`
        .ant-table-thead > tr > th { color: #666 !important; font-weight: 600 !important; font-size: 13px !important; }
      `}</style>
    </div>
  );

  // ---- Order Profit Tab Content ----
  const orderTabContent = (
    <div>
      {/* ========== 4 Module Cards ========== */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small" style={{ borderTop: '3px solid #4568FF' }}>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>模块1：成交价总额</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#4568FF' }}>
              RM {(summary?.module1?.value_myr || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
              ≈ ¥ {(summary?.module1?.value_rmb || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ borderTop: '3px solid #52c41a' }}>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>模块2：总净利润</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: numColor(summary?.module2?.value_rmb || 0) }}>
              ¥ {(summary?.module2?.value_rmb || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
              ≈ RM {(summary?.module2?.value_myr || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>总采购成本(RMB)</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: '#fa8c16' }}>
              ¥ {(summary?.module2?.breakdown?.y || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>总平台费用(RMB)</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: '#ff4d4f' }}>
              ¥ {(summary?.module2?.breakdown?.z || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
              支持费 ¥{(summary?.module2?.breakdown?.a || 0).toFixed(2)}
            </div>
          </Card>
        </Col>
      </Row>

      {/* Formula explanation */}
      <div style={{
        marginBottom: 16, padding: '10px 14px', borderRadius: 8,
        background: '#fffbe6', border: '1px solid #ffe58f',
        fontSize: 12, color: '#ad6800',
      }}>
        <strong>订单利润公式（内置锁定）：</strong>
        净利润 = x - y - z - a - c&nbsp;&nbsp;
        x = (实付金额 - 税费 - 运费) × 汇率&nbsp;&nbsp;
        y = Σ(SKU采购成本 × 数量)&nbsp;&nbsp;
        z = 实付金额 × (交易手续费3.78% + BXP项目费4.86% + 平台佣金10.26%) × 汇率（佣金2026/07/25起生效）&nbsp;&nbsp;
        a = 平台支持费0.45 × 汇率（2026/06/05起生效）&nbsp;&nbsp;
        c = 产品重量g × 0.015 × 汇率
      </div>

      {/* Filters */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <Space wrap>
          <RangePicker
            value={orderDateRange}
            onChange={(v) => setOrderDateRange(v as any)}
            format="YYYY/MM/DD"
            placeholder={['开始日期', '结束日期']}
            allowClear
            style={{ width: 240 }}
          />
          <Select
            placeholder="选择店铺"
            value={orderShopFilter}
            onChange={v => setOrderShopFilter(v || null)}
            allowClear
            style={{ width: 160 }}
            options={orderShops.map((s: any) => ({ value: s.id, label: s.name }))}
          />
          <Button type="primary" onClick={() => { setOrderProfitPage(1); loadOrderProfitData(); }}>查询</Button>
        </Space>
        <div style={{ fontSize: 12, color: '#999' }}>
          MYR兑RMB汇率：<strong style={{ color: BRAND }}>{exchangeRate}</strong>
          <span style={{ marginLeft: 8 }}>
            {summary?.date_from && summary?.date_to
              ? `查看区间：${summary.date_from} ~ ${summary.date_to}`
              : '查看全部时间'}
          </span>
          <span style={{ marginLeft: 8 }}>共 {orderProfitTotal} 笔订单</span>
        </div>
      </div>

      {/* Order Profit Table */}
      <DataTable
        dataSource={orderProfitRecords}
        columns={orderProfitColumns}
        loading={orderProfitLoading}
        serverPagination={{
          current: orderProfitPage,
          total: orderProfitTotal,
          onChange: p => { setOrderProfitPage(p); },
        }}
        scroll={{ x: 1100 }}
      />
    </div>
  );

  return (
    <div style={{ padding: '20px 24px', background: '#f5f3f0', minHeight: '100%' }}>
      {/* 页面标题 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'linear-gradient(135deg, #4568FF, #6B8CFF)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 18,
        }}>
          <DollarOutlined />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#172033' }}>财务核算</h2>
          <span style={{ fontSize: 12, color: '#999' }}>利润核算 · 成本公式 · 趋势分析</span>
        </div>
      </div>

      {/* ========== Tabs ========== */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        style={{ marginBottom: 16 }}
        items={[
          { key: 'product', label: '产品利润核算', children: productTabContent },
          { key: 'order', label: '订单利润', children: orderTabContent },
          { key: 'trend', label: '📈 利润趋势', children: trendTabContent },
        ]}
      />

      {/* ========== Record Modal (Global Formula Config) ========== */}
      <Modal
        title="配置成本公式"
        open={recordModalOpen}
        onCancel={() => setRecordModalOpen(false)}
        width={720}
        onOk={handleRecordSubmit}
        okText="应用全局"
        cancelText="取消"
        okButtonProps={{ style: { background: BRAND, borderColor: BRAND } }}
        footer={canEdit ? undefined : <Button onClick={() => setRecordModalOpen(false)}>关闭</Button>}
      >
        <div style={{ marginBottom: 16, padding: '8px 14px', borderRadius: 8, background: '#fffbe6', border: '1px solid #ffe58f', fontSize: 12, color: '#ad6800' }}>
          全局模式：配置的成本公式将应用到所有产品的核算记录
        </div>

        <div style={{ marginBottom: 12, padding: '6px 12px', borderRadius: 6, background: '#f0f5ff', border: '1px solid #d6e4ff', fontSize: 12, color: '#666' }}>
          <strong>可用变量：</strong>产品重量、售价、采购成本、MYR兑RMB汇率
          {fs.costItems.map(ci => ci.name).length > 0 && <>、{fs.costItems.map(ci => ci.name).join('、')}</>}
          <span style={{ color: '#999', marginLeft: 8 }}>示例：重量 * 8、售价 * 0.05</span>
        </div>

        <Divider style={{ margin: '0 0 16px' }} />

        <div style={{ fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 12, paddingLeft: 8, borderLeft: `3px solid ${BRAND}` }}>
          成本项公式配置
        </div>
        {fs.costItems.map(ci => {
          const isPct = ci.value_format === 'percentage';
          const formulaValue = costFormulas[ci.id] || '';
          return (
            <div key={ci.id} style={{ marginBottom: 12, padding: '8px 10px', borderRadius: 8, background: '#fafafa', border: '1px solid #f0f0f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ width: 100, fontSize: 13, fontWeight: 600, color: '#333', flexShrink: 0 }}>{ci.name}</span>
                <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: isPct ? '#fff0f6' : ci.currency === 'MYR' ? '#fff7e6' : '#f0f0f0', color: isPct ? '#eb2f96' : ci.currency === 'MYR' ? '#fa8c16' : '#666' }}>
                  {isPct ? '%' : ci.currency}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: '#999', flexShrink: 0 }}>公式：</span>
                <Input
                  placeholder="如：重量 * 8 或固定值如 2.5"
                  value={formulaValue}
                  onChange={e => setCostFormulas({ ...costFormulas, [ci.id]: e.target.value })}
                  style={{ flex: 1, fontSize: 13 }}
                  size="small"
                />
              </div>
              {formulaValue && (() => {
                const p = ps.products[0] || fs.records[0];
                if (!p) return null;
                try {
                  const ctx: Record<string, number> = { 售价: p.sell_price || 0, 采购成本: p.cost_price || 0, 产品重量: p.weight || 0, MYR兑RMB汇率: fs.exchangeRate || 1.55 };
                  const result = evaluateFormulaFrontend(formulaValue, ctx);
                  const hasNonZero = result !== 0 || /[1-9]/.test(formulaValue);
                  if (!hasNonZero && !/^[\d\s+\-*/().]+$/.test(formulaValue.replace(/[\u4e00-\u9fffA-Za-z]+/g, ''))) {
                    return <span style={{ fontSize: 11, color: '#ff4d4f', marginLeft: 4 }}>公式格式错误</span>;
                  }
                  const displayVal = Math.round(result * 100) / 100;
                  return <span style={{ fontSize: 11, color: '#52c41a', marginLeft: 4 }}>预览结果：{isPct ? `${displayVal}%` : `${ci.currency === 'MYR' ? 'RM' : '¥'}${displayVal.toFixed(2)}`}</span>;
                } catch {
                  return <span style={{ fontSize: 11, color: '#ff4d4f', marginLeft: 4 }}>公式无法计算</span>;
                }
              })()}
            </div>
          );
        })}
      </Modal>

      {/* ========== Cost Item Management Modal ========== */}
      <Modal
        title="管理成本项"
        open={costModalOpen}
        onCancel={() => setCostModalOpen(false)}
        footer={canEdit ? null : <Button onClick={() => setCostModalOpen(false)}>关闭</Button>}
        width={720}
      >
        <Table
          dataSource={fs.costItems}
          rowKey="id"
          size="small"
          pagination={false}
          columns={[
            { title: '名称', dataIndex: 'name' },
            { title: '公式', dataIndex: 'formula', render: (v: string) => v ? <span style={{ fontSize: 12, fontFamily: 'monospace', color: BRAND }}>{v}</span> : <span style={{ color: '#ccc', fontSize: 12 }}>无</span> },
            { title: '货币', dataIndex: 'currency', render: (v: string) => <span style={{ padding: '1px 6px', borderRadius: 4, fontSize: 11, background: v === 'MYR' ? '#fff7e6' : '#f0f0f0', color: v === 'MYR' ? '#fa8c16' : '#666' }}>{v}</span> },
            { title: '格式', dataIndex: 'value_format', render: (v: string) => <span style={{ padding: '1px 6px', borderRadius: 4, fontSize: 11, background: v === 'percentage' ? '#fff0f6' : '#f0f0f0', color: v === 'percentage' ? '#eb2f96' : '#666' }}>{v === 'percentage' ? '百分比' : '数字'}</span> },
            { title: '类型', dataIndex: 'is_fixed', render: (v: number) => v ? <span style={{ color: '#999', fontSize: 12 }}>固定</span> : <span style={{ color: '#52c41a', fontSize: 12 }}>自定义</span> },
            { title: '操作', width: 120, render: (_: any, record: any) => (
              <Space>
                {canEdit && <Button type="link" size="small" onClick={() => openCostModal(record)}>编辑</Button>}
                {canEdit && !record.is_fixed && <Popconfirm title="确定删除？" onConfirm={() => { fs.deleteCostItem(record.id); loadData(); }}><Button type="link" size="small" danger>删除</Button></Popconfirm>}
              </Space>
            )},
          ]}
        />
        <Divider style={{ margin: '12px 0' }} />
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>{editingCostItem ? '编辑成本项' : '新增成本项'}</div>
        <Form form={costForm} layout="inline" onFinish={handleCostSubmit}>
          <Form.Item name="name" rules={[{ required: true, message: '请输入名称' }]}><Input placeholder="成本项名称" style={{ width: 140 }} /></Form.Item>
          <Form.Item name="formula"><Input placeholder="公式（如：重量 * 8）" style={{ width: 160 }} /></Form.Item>
          <Form.Item name="currency" initialValue="RMB">
            <Select style={{ width: 90 }} options={[{ value: 'RMB', label: '¥ RMB' }, { value: 'MYR', label: 'RM' }, { value: 'USD', label: '$ USD' }]} />
          </Form.Item>
          <Form.Item name="value_format" initialValue="number">
            <Select style={{ width: 90 }} options={[{ value: 'number', label: '数字' }, { value: 'percentage', label: '百分比' }]} />
          </Form.Item>
          {canEdit && <Form.Item><Button type="primary" htmlType="submit" size="small">{editingCostItem ? '更新' : '新增'}</Button></Form.Item>}
          {editingCostItem && <Form.Item><Button size="small" onClick={() => { setEditingCostItem(null); costForm.resetFields(); }}>取消</Button></Form.Item>}
        </Form>
      </Modal>

      {/* ========== Formula Config Modal ========== */}
      <Modal
        title={<Space><FunctionOutlined />配置核算公式</Space>}
        open={formulaModalOpen}
        onCancel={() => setFormulaModalOpen(false)}
        width={860}
        footer={
          <Space>
            {canEdit && <Button onClick={addFormula} icon={<PlusOutlined />}>新增公式</Button>}
            {canEdit && <Button onClick={handleValidateFormulas} icon={<CheckCircleOutlined />}>校验公式</Button>}
            <div style={{ flex: 1 }} />
            <Button onClick={() => setFormulaModalOpen(false)}>取消</Button>
            {canEdit && <Button type="primary" onClick={handleFormulaSave} style={{ background: BRAND, borderColor: BRAND }}>保存并重算</Button>}
          </Space>
        }
      >
        <div style={{ marginBottom: 16, padding: '8px 12px', borderRadius: 6, background: '#f0f5ff', border: '1px solid #d6e4ff', fontSize: 12, color: '#666' }}>
          <div style={{ marginBottom: 4 }}><strong>基础变量：</strong>{baseVariables.join('、')}</div>
          <div style={{ color: '#999' }}>已生成的公式名称可作为变量被后续公式引用（按计算顺序）| 百分比成本项已自动换算为金额</div>
        </div>
        <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 8, background: '#f8fafc', border: '1px solid #e8e8e8' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#333', flexShrink: 0 }}>预览产品：</span>
            <Select value={previewProductId} onChange={v => setPreviewProductId(v)} style={{ width: 280 }} showSearch optionFilterProp="label" placeholder="选择一个产品预览计算结果" options={fs.records.map((r: any) => ({ value: r.product_id, label: `${r.sku || ''} - ${r.product_name || ''}` }))} />
            {(() => { const pr = fs.records.find(r => r.product_id === previewProductId); if (!pr) return null; return <div style={{ fontSize: 12, color: '#666', display: 'flex', gap: 16, flex: 1 }}><span>售价 <strong style={{ color: BRAND }}>RM{(pr.sell_price || 0).toFixed(2)}</strong></span><span>采购成本 <strong style={{ color: '#fa8c16' }}>¥{(pr.cost_price || 0).toFixed(2)}</strong></span><span>重量 <strong>{(pr.weight || 0)}g</strong></span></div>; })()}
          </div>
        </div>
        {globalFormulaError && <div style={{ marginBottom: 12, padding: '6px 12px', borderRadius: 6, background: '#fff2f0', border: '1px solid #ffccc7', fontSize: 12, color: '#ff4d4f' }}><CloseCircleOutlined style={{ marginRight: 4 }} />{globalFormulaError}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 380, overflowY: 'auto', paddingRight: 4 }}>
          {formulaList.map((f, index) => {
            const availableFormulaVars = getFormulaVariablesUpTo(index);
            const hasError = !!formulaErrors[index];
            return (
              <div key={index} onDragOver={(e) => handleDragOver(e, index)} style={{ padding: '10px 12px', borderRadius: 8, border: `1px solid ${hasError ? '#ff4d4f' : dragIndex === index ? BRAND : '#e8e8e8'}`, background: dragIndex === index ? '#f0f5ff' : '#fafafa', transition: 'all 0.15s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <HolderOutlined style={{ color: '#999', cursor: 'grab' }} draggable onDragStart={() => handleDragStart(index)} onDragEnd={handleDragEnd} />
                  <Input placeholder="公式名称" value={f.name} onChange={e => updateFormula(index, 'name', e.target.value)} style={{ width: 220, fontSize: 13, fontWeight: 600 }} status={hasError ? 'error' : undefined} />
                  <Select value={f.format} onChange={v => updateFormula(index, 'format', v)} style={{ width: 110 }} size="small" options={[{ value: 'number', label: '数字' }, { value: 'percentage', label: '百分比' }]} />
                  {f.format === 'number' && <Select value={f.currency || 'MYR'} onChange={v => updateFormula(index, 'currency', v)} style={{ width: 90 }} size="small" options={[{ value: 'none', label: '纯数字' }, { value: 'RMB', label: '¥ RMB' }, { value: 'MYR', label: 'RM' }, { value: 'USD', label: '$ USD' }]} />}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 4 }}><span style={{ fontSize: 11, color: '#999' }}>顺序</span><InputNumber value={f.sort_order} onChange={v => updateFormula(index, 'sort_order', v)} min={1} max={99} size="small" style={{ width: 56 }} controls={false} /></div>
                  <div style={{ flex: 1 }} />
                  {previewData && previewData.formulaResults[f.name] !== undefined && f.name.trim() && f.expression.trim() && (() => {
                    const thisVal = previewData.formulaResults[f.name];
                    const isFinancial = ['净利润', '总投入'].includes(f.name);
                    const isNegative = thisVal < 0;
                    const color = isFinancial ? (isNegative ? '#ff4d4f' : '#52c41a') : '#333';
                    const currencySymbol = f.currency === 'USD' ? '$' : f.currency === 'RMB' ? '¥' : f.currency === 'MYR' ? 'RM' : '';
                    const text = f.format === 'percentage' ? `${(thisVal * 100).toFixed(2)}%` : `${currencySymbol}${thisVal.toFixed(2)}`;
                    return <div style={{ padding: '2px 10px', borderRadius: 4, background: isFinancial && isNegative ? '#fff2f0' : '#f6ffed', border: `1px solid ${isFinancial && isNegative ? '#ffccc7' : '#b7eb8f'}`, fontSize: 13, fontWeight: 600, color }}>{text}</div>;
                  })()}
                  {canEdit && <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => removeFormula(index)} style={{ opacity: 0.5 }} />}
                </div>
                <div style={{ paddingLeft: 28 }}>
                  <Input placeholder="输入公式表达式，如：(售价 - 采购成本) / 售价" value={f.expression} onChange={e => updateFormula(index, 'expression', e.target.value)} style={{ fontSize: 13 }} status={hasError ? 'error' : undefined} />
                  {hasError && <div style={{ color: '#ff4d4f', fontSize: 11, marginTop: 2 }}>{formulaErrors[index]}</div>}
                  {availableFormulaVars.length > 0 && <div style={{ marginTop: 4, fontSize: 11, color: '#999' }}>可引用：{availableFormulaVars.map(v => <Tag key={v} style={{ fontSize: 10, margin: '0 2px' }}>{v}</Tag>)}</div>}
                </div>
              </div>
            );
          })}
        </div>
        {formulaList.length === 0 && <div style={{ textAlign: 'center', padding: '30px 0', color: '#999' }}>暂无公式，点击下方「新增公式」添加</div>}
        {previewData && fs.costItems.length > 0 && (() => {
          return (
            <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, background: '#fafafa', border: '1px solid #f0f0f0' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#333', marginBottom: 6 }}>成本项变量值</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {fs.costItems.map(ci => {
                  const info = previewData.costItemValues[ci.name];
                  if (!info) return null;
                  const currencySymbol = ci.currency === 'MYR' ? 'RM' : ci.currency === 'USD' ? '$' : '¥';
                  return (
                    <div key={ci.id} style={{ padding: '3px 8px', borderRadius: 4, background: info.isPct ? '#fff0f6' : ci.currency === 'MYR' ? '#fff7e6' : '#f6ffed', border: `1px solid ${info.isPct ? '#ffadd2' : ci.currency === 'MYR' ? '#ffd591' : '#b7eb8f'}`, fontSize: 11 }}>
                      <span style={{ color: '#666' }}>{ci.name}</span>
                      {info.isPct ? <span style={{ fontWeight: 600, color: '#333', marginLeft: 4 }}>{info.raw.toFixed(2)}% → ¥{info.ctx.toFixed(2)}</span>
                        : ci.currency === 'MYR' ? <span style={{ fontWeight: 600, color: '#333', marginLeft: 4 }}>RM{info.raw.toFixed(2)} → ¥{info.ctx.toFixed(2)}</span>
                          : <span style={{ fontWeight: 600, color: '#333', marginLeft: 4 }}>{currencySymbol}{info.ctx.toFixed(2)}</span>}
                    </div>
                  );
                })}
                <div style={{ padding: '3px 8px', borderRadius: 4, background: '#f0f5ff', border: '1px solid #d6e4ff', fontSize: 11 }}><span style={{ color: '#666' }}>MYR成本合计RMB</span><span style={{ fontWeight: 600, color: BRAND, marginLeft: 4 }}>¥{previewData.myrTotalRmb.toFixed(2)}</span></div>
              </div>
            </div>
          );
        })()}
        <div style={{ fontSize: 11, color: '#999', marginTop: 10 }}>拖拽把手可调整计算顺序 | 支持运算符：+ - * / ( )</div>
      </Modal>

      {/* ========== Order Profit Detail Modal ========== */}
      <Modal
        title={<Space><CalculatorOutlined />订单利润详情</Space>}
        open={!!orderProfitDetailModal}
        onCancel={() => setOrderProfitDetailModal(null)}
        footer={null}
        width={640}
      >
        {orderProfitDetailModal && (() => {
          const d = orderProfitDetailModal.profit_data || {};
          const fd = d.fee_breakdown || {};
          return (
            <div>
              <Row gutter={[16, 12]} style={{ marginBottom: 16 }}>
                <Col span={12}><div style={{ fontSize: 12, color: '#666' }}>订单号</div><div style={{ fontWeight: 600 }}>{orderProfitDetailModal.order_no}</div></Col>
                <Col span={12}><div style={{ fontSize: 12, color: '#666' }}>店铺</div><div style={{ fontWeight: 600 }}>{orderProfitDetailModal.shop_name || '-'}</div></Col>
                <Col span={12}><div style={{ fontSize: 12, color: '#666' }}>订单时间</div><div>{orderProfitDetailModal.order_time?.slice(0, 19) || '-'}</div></Col>
                <Col span={12}><div style={{ fontSize: 12, color: '#666' }}>实付金额</div><div style={{ color: BRAND, fontWeight: 600 }}>RM {(d.actual_amount || 0).toFixed(2)}</div></Col>
                <Col span={8}><div style={{ fontSize: 12, color: '#666' }}>税费</div><div>RM {(d.taxes || 0).toFixed(2)}</div></Col>
                <Col span={8}><div style={{ fontSize: 12, color: '#666' }}>运费</div><div>RM {(d.shipping_fee || 0).toFixed(2)}</div></Col>
                <Col span={8}><div style={{ fontSize: 12, color: '#666' }}>净收入(MYR)</div><div style={{ color: '#52c41a', fontWeight: 600 }}>RM {(d.net_revenue_myr || 0).toFixed(2)}</div></Col>
              </Row>

              <Divider style={{ margin: '8px 0' }} />

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: '#333' }}>利润计算明细（汇率：{exchangeRate}）</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[
                    { label: 'x = 净收入 × 汇率', value: `(${d.actual_amount || 0} - ${d.taxes || 0} - ${d.shipping_fee || 0}) × ${exchangeRate}`, result: d.x || 0, color: '#52c41a' },
                    { label: 'y = SKU采购成本合计', value: 'Σ(数量 × SKU采购成本)', result: d.y || 0, color: '#fa8c16' },
                    { label: 'z = 平台费用', value: `${d.actual_amount || 0} × (3.78%${fd.commission_applied ? ' + 10.26%' : ''} + 4.86%) × ${exchangeRate}`, result: d.z || 0, color: '#ff4d4f' },
                    { label: 'a = 平台支持费', value: fd.platform_support_applied ? `0.45 × ${exchangeRate}` : '（2026/06/05前不计）', result: d.a || 0, color: '#ff4d4f' },
                    { label: 'c = 跨境运费', value: d.product_weight_g ? `${d.product_weight_g}g × 0.015 × ${exchangeRate}` : '（未设置产品重量）', result: d.c || 0, color: '#ff4d4f' },
                    { label: '净利润 = x - y - z - a - c', value: '', result: d.net_profit || 0, color: numColor(d.net_profit || 0), bold: true },
                  ].map(item => (
                    <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', borderRadius: 6, background: '#f8fafc', border: '1px solid #e8e8e8' }}>
                      <span style={{ color: '#666', fontSize: 12 }}>{item.label}</span>
                      <span style={{ color: '#999', fontSize: 11, marginRight: 8 }}>{item.value}</span>
                      <span style={{ color: item.color, fontWeight: item.bold ? 700 : 600, fontSize: 13 }}>¥ {Number(item.result).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ fontSize: 12, color: '#999', marginTop: 8 }}>
                {fd.commission_applied ? <Tag color="green" style={{ fontSize: 10 }}>平台佣金已生效(10.26%)</Tag> : <Tag style={{ fontSize: 10 }}>平台佣金未生效(2026/07/25起)</Tag>}
                {fd.platform_support_applied ? <Tag color="green" style={{ fontSize: 10, marginLeft: 4 }}>平台支持费已生效(¥{(0.45 * exchangeRate).toFixed(2)})</Tag> : <Tag style={{ fontSize: 10, marginLeft: 4 }}>平台支持费未生效(2026/06/05起)</Tag>}
              </div>

              {d.sku_costs && d.sku_costs.length > 0 && (
                <>
                  <Divider style={{ margin: '8px 0' }} />
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>SKU采购明细</div>
                  <Table
                    size="small"
                    dataSource={d.sku_costs}
                    rowKey={((_r: any, i: number) => i) as any}
                    pagination={false}
                    columns={[
                      { title: 'SKU', dataIndex: 'sku', render: (v: string) => v || '-' },
                      { title: '规格', dataIndex: 'spec_name', render: (v: string) => v || '-' },
                      { title: '数量', dataIndex: 'quantity', render: (v: number) => v || 1 },
                      { title: '采购单价(RMB)', dataIndex: 'cost_price', render: (v: number) => `¥ ${(v || 0).toFixed(2)}` },
                      { title: '小计(RMB)', dataIndex: 'item_cost', render: (v: number) => <strong style={{ color: '#fa8c16' }}>¥ {(v || 0).toFixed(2)}</strong> },
                    ]}
                  />
                </>
              )}
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
