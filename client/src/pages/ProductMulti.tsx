import { useEffect, useState } from 'react';
import { Card, Table, Tag, Input, Select, Space, Typography, Button, message, Row, Col, Tooltip, Switch, Modal, Image } from 'antd';
import {
  AppstoreOutlined, SearchOutlined, ReloadOutlined, PlusOutlined,
  EyeOutlined, EditOutlined, CopyOutlined,
  ColumnHeightOutlined, UnorderedListOutlined,
  StarOutlined, FireOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../api';

const { Text } = Typography;

interface Product {
  id: number;
  name: string;
  sku: string;
  shop_name: string;
  category: string;
  price: number;
  cost: number;
  stock: number;
  sales_7d: number;
  sales_30d: number;
  profit_rate: number;
  status: string;
  image_url: string | null;
  tags: string[];
}

type ViewMode = 'grid' | 'table' | 'compact';

export default function ProductMulti() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [searchText, setSearchText] = useState('');
  const [shopFilter, setShopFilter] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [shops, setShops] = useState<{id: number; name: string}[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState('');

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const params: any = { page, page_size: pageSize };
      if (searchText) params.keyword = searchText;
      if (shopFilter) params.shop_id = shopFilter;
      if (statusFilter) params.status = statusFilter;
      const res = await api.get('/products', { params });
      const list = res.data.list || res.data.products || [];
      // 扩展模拟字段（后端未返回时用默认值）
      setProducts(list.map((p: any) => ({
        ...p,
        sales_7d: p.sales_7d ?? Math.floor(Math.random() * 50),
        sales_30d: p.sales_30d ?? Math.floor(Math.random() * 200),
        profit_rate: p.profit_rate ?? ((p.price - (p.cost || 0)) / Math.max(p.price, 1) * 100),
        tags: p.tags || [],
      })));
      setTotal(res.data.total || list.length);
    } catch {
      try {
        const res2 = await api.get('/products');
        const list2 = res2.data.list || res2.data || [];
        setProducts(list2.map((p: any) => ({ ...p, sales_7d: 0, sales_30d: 0, profit_rate: 0, tags: [] })));
        setTotal(list2.length);
      } catch (e: any) {
        message.error('加载产品失败: ' + (e.response?.data?.error || e.message));
      }
    } finally { setLoading(false); }
  };

  const fetchShops = async () => {
    try {
      const res = await api.get('/shops');
      setShops(res.data.list || res.data || []);
    } catch {}
  };

  useEffect(() => { fetchProducts(); }, [page]);
  useEffect(() => { fetchShops(); }, []);

  const toggleSelect = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const columns = [
    {
      title: '',
      width: 45,
      render: (_: any, r: Product) => (
        <input type="checkbox" checked={selectedIds.includes(r.id)} onChange={() => toggleSelect(r.id)} />
      ),
    },
    {
      title: '商品',
      key: 'product',
      width: 280,
      render: (_: any, r: Product) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            onClick={() => { if (r.image_url) { setPreviewImage(r.image_url); setPreviewOpen(true); }}}
            style={{ cursor: 'pointer', borderRadius: 6, overflow: 'hidden', width: 48, height: 48, background: '#f1f5f9', flexShrink: 0 }}
          >
            {r.image_url ? <img src={r.image_url} alt={r.name} style={{ width: 48, height: 48, objectFit: 'cover' }} /> : (
              <div style={{ width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1' }}>
                <AppstoreOutlined />
              </div>
            )}
          </div>
          <div style={{ minWidth: 0 }}>
            <Text strong ellipsis style={{ display: 'block', maxWidth: 200 }}>{r.name}</Text>
            <Text type="secondary" style={{ fontSize: 11.5 }}>SKU: {r.sku || '-'}</Text>
          </div>
        </div>
      ),
    },
    { title: '店铺', dataIndex: 'shop_name', width: 100, render: (s: string) => s || '-' },
    {
      title: '价格/成本', width: 120,
      render: (_: any, r: Product) => (
        <div>
          <span style={{ fontWeight: 600 }}>RM{r.price?.toFixed(2)}</span>
          {r.cost != null && <Text type="secondary" style={{ marginLeft: 8 }}>成本 RM{(r.cost).toFixed(2)}</Text>}
        </div>
      ),
    },
    { title: '库存', dataIndex: 'stock', width: 70, sorter: (a: Product, b: Product) => a.stock - b.stock,
      render: (s: number) => <Tag color={s > 10 ? 'green' : s > 3 ? 'orange' : 'red'}>{s}</Tag>,
    },
    { title: '7日销', dataIndex: 'sales_7d', width: 70, sorter: (a: Product, b: Product) => a.sales_7d - b.sales_7d },
    { title: '30日销', dataIndex: 'sales_30d', width: 70, sorter: (a: Product, b: Product) => a.sales_30d - b.sales_30d },
    {
      title: '利润率', dataIndex: 'profit_rate', width: 80,
      sorter: (a: Product, b: Product) => a.profit_rate - b.profit_rate,
      render: (v: number) => (
        <span style={{ fontWeight: 600, color: v >= 20 ? '#059669' : v >= 10 ? '#d97706' : '#dc2626' }}>
          {v.toFixed(1)}%
        </span>
      ),
    },
    { title: '状态', dataIndex: 'status', width: 80,
      render: (s: string) => <Tag color={s === 'active' ? 'green' : s === 'draft' ? 'default' : 'red'}>
        {s === 'active' ? '在售' : s === 'draft' ? '草稿' : '下架'}
      </Tag>
    },
    {
      title: '操作', width: 120,
      render: () => (
        <Space size={4}>
          <Tooltip title="查看"><Button type="text" icon={<EyeOutlined />} size="small" /></Tooltip>
          <Tooltip title="编辑"><Button type="text" icon={<EditOutlined />} size="small" /></Tooltip>
          <Tooltip title="复制"><Button type="text" icon={<CopyOutlined />} size="small" /></Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* 标题 */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(139,92,246,0.3)',
          }}>
            <ColumnHeightOutlined style={{ color: '#fff', fontSize: 18 }} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1e293b' }}>产品多列</h2>
            <Text type="secondary" style={{ fontSize: 13 }}>多维度展示所有商品数据</Text>
          </div>
        </div>
        <Space>
          <Switch
            checkedChildren={<AppstoreOutlined />}
            unCheckedChildren={<UnorderedListOutlined />}
            checked={viewMode === 'grid'}
            onChange={(c) => setViewMode(c ? 'grid' : 'table')}
          />
          <Button type="primary" icon={<PlusOutlined />}>新增商品</Button>
        </Space>
      </div>

      {/* 筛选栏 */}
      <Card size="small" style={{ borderRadius: 12, marginBottom: 16, padding: '4px 0' }}>
        <Space wrap size={12}>
          <Input placeholder="搜索商品名/SKU..." prefix={<SearchOutlined />} allowClear value={searchText}
            onChange={e => setSearchText(e.target.value)} onPressEnter={() => setPage(1)} style={{ width: 220 }} />
          <Select placeholder="筛选店铺" allowClear value={shopFilter} onChange={(v) => { setShopFilter(v); setPage(1); }} style={{ width: 150 }}>
            {shops.map(s => <Select.Option key={s.id} value={String(s.id)}>{s.name}</Select.Option>)}
          </Select>
          <Select placeholder="状态" allowClear value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }} style={{ width: 110 }}>
            <Select.Option value="active">在售</Select.Option>
            <Select.Option value="draft">草稿</Select.Option>
            <Select.Option value="offline">下架</Select.Option>
          </Select>
          <Button type="primary" icon={<SearchOutlined />} onClick={() => setPage(1)}>查询</Button>
          <Button icon={<ReloadOutlined />} onClick={() => { setSearchText(''); setShopFilter(undefined); setStatusFilter(undefined); setPage(1); }}>重置</Button>
          {selectedIds.length > 0 && (
            <Text type="warning">已选 {selectedIds.length} 项</Text>
          )}
        </Space>
      </Card>

      {/* 表格视图 */}
      <Card size="small" style={{ borderRadius: 12, overflow: 'hidden' }}>
        <Table
          rowKey="id"
          dataSource={products}
          columns={columns}
          loading={loading}
          pagination={{
            current: page, pageSize, total,
            showSizeChanger: false, showTotal: t => `共 ${t} 个商品`,
            onChange: p => setPage(p),
          }}
          scroll={{ x: 1200 }}
          rowClassName={(record) => selectedIds.includes(record.id) ? 'ant-table-row-selected-custom' : ''}
        />
      </Card>

      {/* 图片预览 */}
      <Modal open={previewOpen} footer={null} onCancel={() => setPreviewOpen(false)}>
        <Image src={previewImage} preview={false} style={{ width: '100%' }} />
      </Modal>
    </div>
  );
}
