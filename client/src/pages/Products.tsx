import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  Table, Button, Input, Select, Space, Modal, Form, InputNumber, Popconfirm, message, Dropdown, Divider, Tag, Spin
} from 'antd';
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, UploadOutlined, CloseOutlined, UnorderedListOutlined, AppstoreOutlined, CloudDownloadOutlined, SyncOutlined, CheckCircleFilled, CloseCircleFilled, LoadingOutlined, MoreOutlined, EllipsisOutlined } from '@ant-design/icons';
import { useProductStore, ProductShop, ProductSku } from '../stores/productStore';
import { useHasPerm } from '../stores/authStore';
import type { ColumnsType } from 'antd/es/table';
import DataTable from '../components/DataTable';
import ExportButton from '../components/ExportButton';
import { PageHeader } from '../components/design-system';

const T = { primary: '#4568FF', primaryLight: '#EDF0FF', cardBorder: '#EEF1F6', cardRadius: 16, textPrimary: '#172033', textSecondary: '#64748B', textTertiary: '#94A3B8', success: '#22C55E', warning: '#F59E0B', danger: '#EF4444' };

/** Sync result statistic card */
function ResultCard({ icon, color, bg, label, value }: {
  icon: React.ReactNode;
  color: string;
  bg: string;
  label: string;
  value: number;
}) {
  return (
    <div style={{
      background: bg, borderRadius: 10, padding: '16px 12px',
      textAlign: 'center', border: `1px solid ${color}20`,
    }}>
      <div style={{ fontSize: 24, color, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color, lineHeight: 1.2 }}>{value}</div>
      <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{label}</div>
    </div>
  );
}

export default function Products() {
  const canEdit = useHasPerm('products', 'edit');
  const store = useProductStore();
  const [keyword, setKeyword] = useState('');
  const [shopFilter, setShopFilter] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  // Product modal
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [productForm] = Form.useForm();
  const [skuRows, setSkuRows] = useState<any[]>([{ key: Date.now() }]);
  const [shopRows, setShopRows] = useState<ProductShop[]>([]);
  const [imageUrl, setImageUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Detail modal (read-only)
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailProduct, setDetailProduct] = useState<any>(null);
  // SKU detail modal (read-only / editable)
  const [skuModalOpen, setSkuModalOpen] = useState(false);
  const [skuModalProduct, setSkuModalProduct] = useState<any>(null);
  // TikTok sync
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [selectedShopId, setSelectedShopId] = useState<number | undefined>();
  const [syncResult, setSyncResult] = useState<any>(null);
  const [syncError, setSyncError] = useState('');

  useEffect(() => {
    store.fetchProducts();
    store.fetchSuppliers();
    store.fetchShops();
  }, []);

  const handleSearch = () => {
    store.fetchProducts(keyword, shopFilter);
  };

  // Upload SKU image for a specific row
  const handleSkuImageUpload = (file: File, idx: number) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const base64 = e.target?.result as string;
        const { data } = await (await import('../api')).default.post('/products/upload-image', { image: base64 });
        const newRows = [...skuRows];
        newRows[idx] = { ...newRows[idx], image: data.url };
        setSkuRows(newRows);
        message.success('SKU图片上传成功');
      } catch {
        message.error('SKU图片上传失败');
      }
    };
    reader.readAsDataURL(file);
    return false;
  };

  // Upload product main image
  const handleImageUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const base64 = e.target?.result as string;
        const { data } = await (await import('../api')).default.post('/products/upload-image', { image: base64 });
        setImageUrl(data.url);
        message.success('图片上传成功');
      } catch {
        message.error('图片上传失败');
      }
    };
    reader.readAsDataURL(file);
    return false;
  };

  // ============ Product Modal ============

  const openProductModal = (record?: any) => {
    if (record) {
      setEditingProduct(record);
      productForm.setFieldsValue({
        name: record.name,
        weight: record.weight,
        supplier_id: record.supplier_id,
        box_qty: record.box_qty,
        box_length: record.box_length,
        box_width: record.box_width,
        box_height: record.box_height,
        box_remark: record.box_remark,
        commission: record.commission || 0,
      });
      setImageUrl(record.image || '');
      // Load SKUs from product_skus
      setSkuRows(record.skus?.length > 0
        ? record.skus.map((s: ProductSku, i: number) => ({ ...s, key: i }))
        : [{ key: Date.now() }]);
      setShopRows(record.shops?.length > 0 ? record.shops.map((s: any) => ({ shop_name: s.shop_name || s })) : [{ shop_name: '' }]);
    } else {
      setEditingProduct(null);
      productForm.resetFields();
      setImageUrl('');
      setSkuRows([{ key: Date.now() }]);
      setShopRows([{ shop_name: '', shop_price: 0 }]);
    }
    setProductModalOpen(true);
  };

  const handleProductSubmit = async (values: any) => {
    const skus = skuRows.map(s => ({
      sku_code: s.sku_code || '',
      spec_name: s.spec_name || '',
      cost_price: s.cost_price || 0,
      sell_price: s.sell_price || 0,
      stock: s.stock || 0,
      image: s.image || '',
    }));
    // Validate at least 1 SKU has spec_name
    if (skus.every(s => !s.spec_name)) {
      message.error('至少填写1个SKU的规格名称');
      return;
    }
    const payload = {
      ...values,
      image: imageUrl,
      skus,
      shops: shopRows.filter(s => s.shop_name).map(s => ({ shop_name: s.shop_name })),
    };
    try {
      if (editingProduct) {
        await store.updateProduct(editingProduct.id, payload);
      } else {
        await store.createProduct(payload);
      }
      setProductModalOpen(false);
      message.success(editingProduct ? '更新成功' : '创建成功');
    } catch (e: any) {
      message.error(e.response?.data?.error || '操作失败');
    }
  };

  const handleExport = async () => {
    try {
      const { data } = await (await import('../api')).default.get('/products/export');
      const XLSX = await import('xlsx');
      const STAT_LABEL: Record<string, string> = { active: '在售', inactive: '已下架', frozen: '已下架', deleted: '已删除', draft: '草稿', pending: '审核中', rejected: '未通过' };
      const ws = XLSX.utils.json_to_sheet(data.map((p: any) => ({
        产品名称: p.name,
        产品状态: STAT_LABEL[p.status] || p.status || '',
        重量: p.weight ? `${p.weight}g` : '',
        总库存: p.stock || 0,
        总库存: p.stock || 0,
        SKU数量: p.skus?.length || 0,
        SKU明细: p.skus?.map((s: any) => `${s.spec_name}(${s.sku_code}) RM${s.sell_price} 库存${s.stock}`).join('; ') || '',
        供应商: p.supplier_name || '',
        店铺: p.shops?.map((s: any) => `${s.shop_name}`).join('; ') || '',
        箱规: p.box_qty ? `${p.box_qty}件/箱 ${p.box_length}×${p.box_width}×${p.box_height}cm` : '',
      })));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '产品列表');
      XLSX.writeFile(wb, `MERA_产品列表_${new Date().toISOString().slice(0, 10)}.xlsx`);
      message.success('导出成功');
    } catch {
      message.error('导出失败');
    }
  };

  // ============ TikTok Sync ============

  const handleOpenSyncModal = () => {
    store.fetchTikTokShops();
    setSyncResult(null);
    setSyncError('');
    setSelectedShopId(undefined);
    setSyncModalOpen(true);
  };

  const handleSyncStart = async () => {
    if (!selectedShopId) {
      message.warning('请先选择要同步的店铺');
      return;
    }
    setSyncResult(null);
    setSyncError('');
    try {
      const result = await store.syncFromTikTok(selectedShopId);
      setSyncResult(result);
      if (result.created > 0 || result.updated > 0) {
        message.success(`同步完成：新增 ${result.created} 个，更新 ${result.updated} 个`);
      } else if (result.errors.length > 0) {
        message.warning(`同步部分失败：${result.errors.slice(0, 2).join('；')}`);
      } else {
        message.info('无新数据或变更');
      }
    } catch (e: any) {
      setSyncError(e.response?.data?.errors?.[0] || e.message || '同步请求失败，请检查店铺凭证');
      message.error('同步失败');
    }
  };

  // ============ Detail Modal (read-only) ============

  const openDetail = async (record: any) => {
    try {
      const data = await store.fetchProduct(record.id);
      setDetailProduct(data);
      setDetailModalOpen(true);
    } catch {
      message.error('加载详情失败');
    }
  };

  // ============ SKU Modal ============

  const openSkuModal = async (record: any) => {
    try {
      const data = await store.fetchProduct(record.id);
      setSkuModalProduct(data);
      setSkuModalOpen(true);
    } catch {
      message.error('加载SKU详情失败');
    }
  };

  // ============ Table Columns ============

  const stockStatus = (stock: number) => {
    if (stock <= 0) return { color: T.danger, bg: '#FEF2F2', label: '缺货', dot: T.danger };
    if (stock <= 20) return { color: T.warning, bg: '#FFFBEB', label: '库存偏低', dot: T.warning };
    return { color: T.success, bg: '#F0FDF4', label: '库存充足', dot: T.success };
  };

  const productColumns: ColumnsType<any> = [
    {
      title: '商品', width: 340,
      render: (_: any, r: any) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 60, height: 60, borderRadius: 12, overflow: 'hidden', flexShrink: 0,
            background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: `1px solid ${T.cardBorder}`,
          }}>
            {r.image ? (
              <img src={r.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e: any) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
            ) : null}
            <div style={{ display: r.image ? 'none' : 'flex', fontSize: 26, color: T.textTertiary }}><AppstoreOutlined /></div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <a onClick={() => openDetail(r)}
              style={{ color: T.textPrimary, fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'block', lineHeight: 1.4 }}
              onMouseEnter={e => { e.currentTarget.style.color = T.primary; }}
              onMouseLeave={e => { e.currentTarget.style.color = T.textPrimary; }}>
              {r.name}
            </a>
            <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 3 }}>SKU: {r.sku || `FG${String(r.id || '').padStart(3, '0')}`}</div>
          </div>
        </div>
      ),
    },
    {
      title: '店铺', width: 120,
      render: (_: any, r: any) => {
        const shops = r.shops;
        if (!shops || shops.length === 0) return <span style={{ color: T.textTertiary, fontSize: 12 }}>—</span>;
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {shops.map((s: any, i: number) => (
              <Tag key={i} style={{ borderRadius: 6, border: 'none', background: T.primaryLight, color: T.primary, fontSize: 11, fontWeight: 600, padding: '2px 8px', margin: 0 }}>
                {s.shop_name}
              </Tag>
            ))}
          </div>
        );
      },
    },
    {
      title: '产品状态', width: 90, align: 'center' as const,
      render: (_: any, r: any) => {
        const s = r.status || 'active';
        const map: Record<string, { label: string; color: string }> = {
          active: { label: '在售', color: '#22C55E' },
          inactive: { label: '已下架', color: '#F59E0B' },
          frozen: { label: '已下架', color: '#F59E0B' },
          deleted: { label: '已删除', color: '#EF4444' },
          draft: { label: '草稿', color: '#94A3B8' },
          pending: { label: '审核中', color: '#4F6BFF' },
          rejected: { label: '未通过', color: '#EF4444' },
        };
        const m = map[s] || { label: s, color: '#94A3B8' };
        return <Tag style={{ borderRadius: 6, border: 'none', background: `${m.color}18`, color: m.color, fontSize: 11, fontWeight: 600, margin: 0 }}>{m.label}</Tag>;
      },
    },
    {
      title: '售价', dataIndex: 'sell_price', width: 100, align: 'right' as const,
      render: (v: number) => v ? <span style={{ color: T.textPrimary, fontSize: 14, fontWeight: 700, fontFamily: '"Inter", sans-serif' }}>RM {v.toFixed(2)}</span> : <span style={{ color: T.textTertiary }}>—</span>,
    },
    {
      title: 'SKU', width: 80, align: 'center' as const,
      render: (_: any, r: any) => {
        const count = r.skus?.length || 0;
        return <span style={{ color: T.primary, fontWeight: 600, fontSize: 13, background: T.primaryLight, padding: '2px 10px', borderRadius: 6 }}>{count}</span>;
      },
    },
    {
      title: '库存状态', width: 130,
      render: (_: any, r: any) => {
        const s = stockStatus(r.stock || 0);
        return (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
              <span style={{ fontSize: 15, fontWeight: 700, color: T.textPrimary, fontFamily: '"Inter", sans-serif' }}>{r.stock || 0}</span>
            </div>
            <div style={{ fontSize: 11, color: s.color, fontWeight: 500, marginTop: 2, paddingLeft: 12 }}>{s.label}</div>
          </div>
        );
      },
    },
    {
      title: '操作', width: 60, align: 'center' as const,
      render: (_: any, r: any) => (
        <Dropdown
          trigger={['click']}
          menu={{
            items: [
              { key: 'sku', icon: <UnorderedListOutlined />, label: '查看 SKU', onClick: () => openSkuModal(r) },
              ...(canEdit ? [{ key: 'edit', icon: <EditOutlined />, label: '编辑商品', onClick: () => openProductModal(r) }] : []),
              ...(!canEdit ? [{ key: 'view', icon: <SearchOutlined />, label: '查看详情', onClick: () => openDetail(r) }] : []),
              ...(canEdit ? [{ key: 'delete', icon: <DeleteOutlined />, label: '删除商品', danger: true, onClick: () => { Modal.confirm({ title: '确认删除此产品？', okType: 'danger', okText: '删除', onOk: () => store.deleteProduct(r.id) }); } }] : []),
            ],
          }}>
          <Button type="text" icon={<MoreOutlined />} style={{ color: T.textTertiary, borderRadius: 8, fontSize: 16 }} />
        </Dropdown>
      ),
    },
  ];

  const filteredProducts = useMemo(() => {
    if (!statusFilter) return store.products;
    return store.products.filter(p => p.status === statusFilter);
  }, [store.products, statusFilter]);

  return (
    <div style={{ padding: '20px 24px', background: 'var(--bo-page-bg)', minHeight: '100%' }}>
      <PageHeader title="商品管理" description="产品信息 · SKU管理 · 库存追踪" icon={<AppstoreOutlined />} />

      {/* ═══ Stats Summary ═══ */}
      {(() => {
        const prods = store.products;
        const total = prods.length;
        const normal = prods.filter(p => (p.stock || 0) > 20).length;
        const low = prods.filter(p => { const s = p.stock || 0; return s > 0 && s <= 20; }).length;
        const out = prods.filter(p => (p.stock || 0) === 0).length;
        const stats = [
          { label: '全部商品', value: total, color: T.primary, bg: T.primaryLight },
          { label: '库存充足', value: normal, color: T.success, bg: '#F0FDF4' },
          { label: '库存偏低', value: low, color: T.warning, bg: '#FFFBEB' },
          { label: '缺货', value: out, color: T.danger, bg: '#FEF2F2' },
        ];
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
            {stats.map(s => (
              <div key={s.label} style={{
                background: '#fff', borderRadius: T.cardRadius, border: `1px solid ${T.cardBorder}`,
                padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: s.color, fontFamily: '"Inter", sans-serif', flexShrink: 0 }}>
                  {s.value}
                </div>
                <div style={{ fontSize: 12, color: T.textSecondary, fontWeight: 500 }}>{s.label}</div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* ═══ Filter Bar ═══ */}
      <div style={{
        marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 16px', background: '#fff', borderRadius: 12,
        border: `1px solid ${T.cardBorder}`,
      }}>
        <Space>
          <Input
            placeholder="搜索产品名称/SKU编码"
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            prefix={<SearchOutlined />}
            style={{ width: 240, borderRadius: 8 }}
            allowClear
            onPressEnter={handleSearch}
          />
          <Select
            placeholder="按店铺筛选"
            value={shopFilter}
            onChange={(v) => { setShopFilter(v); store.fetchProducts(keyword, v); }}
            style={{ width: 160, borderRadius: 8 }}
            allowClear
            options={store.shopList.map(s => ({ value: s, label: s }))}
          />
          <Select
            placeholder="产品状态"
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 120, borderRadius: 8 }}
            allowClear
            options={[
              { value: 'active', label: '在售' },
              { value: 'inactive', label: '已下架' },
              { value: 'frozen', label: '已下架' },
              { value: 'deleted', label: '已删除' },
              { value: 'draft', label: '草稿' },
              { value: 'pending', label: '审核中' },
              { value: 'rejected', label: '未通过' },
            ]}
          />
          <Button onClick={handleSearch} style={{ borderRadius: 8 }}>搜索</Button>
        </Space>
        <Space>
          {canEdit && <Button icon={<UploadOutlined />} onClick={() => message.info('导入功能：请准备Excel数据后使用')} style={{ borderRadius: 8 }}>导入</Button>}
          <ExportButton onExport={handleExport}>导出Excel</ExportButton>
          {canEdit && (
            <Button icon={<CloudDownloadOutlined />} onClick={handleOpenSyncModal} style={{ borderColor: T.primary, color: T.primary, borderRadius: 8 }}>
              同步TikTok产品
            </Button>
          )}
          {canEdit && <Button type="primary" icon={<PlusOutlined />} onClick={() => openProductModal()} style={{ borderRadius: 10, background: T.primary }}>新增产品</Button>}
        </Space>
      </div>

      {/* ========== Product Table ========== */}
      <DataTable
        dataSource={filteredProducts}
        columns={productColumns}
        loading={store.loading}
        scroll={{ x: 900 }}
        rowClassName={() => ''}
      />

      {/* ========== Global Styles ========== */}
      <style>{`
        .ant-table-thead > tr > th {
          color: #666 !important;
          font-weight: 600 !important;
          font-size: 13px !important;
        }
        .xzg-section-title {
          font-size: 13px;
          font-weight: 600;
          color: #333;
          margin-bottom: 12px;
          padding-left: 8px;
          border-left: 3px solid ${T.primary};
        }
        .xzg-shop-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }
        .xzg-shop-row .ant-form-item {
          margin-bottom: 0;
        }
        .xzg-shop-label {
          font-size: 12px;
          color: #888;
          white-space: nowrap;
          width: 52px;
          flex-shrink: 0;
        }
        .xzg-desc-label {
          color: #888;
          font-size: 13px;
        }
        .xzg-desc-value {
          color: #333;
          font-size: 13px;
        }
      `}</style>

      {/* ========== Product Add/Edit Modal ========== */}
      <Modal
        title={editingProduct ? '编辑产品' : '新增产品'}
        open={productModalOpen}
        onCancel={() => setProductModalOpen(false)}
        width={860}
        onOk={() => productForm.submit()}
        okText="提交"
        cancelText="取消"
        okButtonProps={{ style: { background: T.primary, borderColor: T.primary } }}
        footer={canEdit ? undefined : <Button onClick={() => setProductModalOpen(false)}>关闭</Button>}
      >
        <Form form={productForm} layout="vertical" onFinish={handleProductSubmit}>
          {/* Section 1: Basic Info */}
          <div className="xzg-section-title">基础信息</div>
          <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
            {/* Image Upload */}
            <div style={{ flexShrink: 0 }}>
              <div style={{
                width: 80, height: 80, borderRadius: 8, overflow: 'hidden',
                background: '#f5f5f5', border: '1px dashed #d9d9d9', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }} onClick={() => fileInputRef.current?.click()}>
                {imageUrl ? (
                  <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <UploadOutlined style={{ fontSize: 24, color: '#999' }} />
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); }}
              />
              <div style={{ fontSize: 11, color: '#999', textAlign: 'center', marginTop: 4 }}>产品图片</div>
            </div>
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
              <Form.Item name="name" label="产品名称" rules={[{ required: true, message: '请输入产品名称' }]}>
                <Input placeholder="产品名称" />
              </Form.Item>
              <Form.Item name="weight" label="产品重量">
                <InputNumber placeholder="重量(g)" suffix="g" style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="supplier_id" label="供应商" style={{ gridColumn: 'span 2' }}>
                <Select placeholder="选择供应商" allowClear options={store.suppliers.map(s => ({ value: s.id, label: s.name }))} />
              </Form.Item>
              <Form.Item name="commission" label="达人佣金" tooltip="百分比，同步到财务核算时自动填入">
                <InputNumber placeholder="0" suffix="%" min={0} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </div>
          </div>

          <Divider style={{ margin: '8px 0 16px' }} />

          {/* Section 2: SKU Details */}
          <div className="xzg-section-title">
            SKU明细
            <span style={{ fontSize: 12, fontWeight: 400, color: '#999', marginLeft: 8 }}>至少填写1个SKU（带 * 为必填）</span>
          </div>
          <div style={{ marginBottom: 8 }}>
            {/* Header row */}
            <div style={{ display: 'grid', gridTemplateColumns: '60px 140px 140px 120px 120px 90px 32px', gap: 8, marginBottom: 6, paddingLeft: 2 }}>
              <span style={{ fontWeight: 600, color: '#333', fontSize: 13 }}>SKU图片</span>
              <span style={{ fontWeight: 600, color: '#333', fontSize: 13 }}>规格名称 *</span>
              <span style={{ fontWeight: 600, color: '#333', fontSize: 13 }}>SKU编码</span>
              <span style={{ fontWeight: 600, color: '#333', fontSize: 13 }}>采购成本</span>
              <span style={{ fontWeight: 600, color: '#333', fontSize: 13 }}>售价</span>
              <span style={{ fontWeight: 600, color: '#333', fontSize: 13 }}>库存</span>
              <span />
            </div>
            {skuRows.map((row, idx) => (
              <div key={row.key} style={{ display: 'grid', gridTemplateColumns: '60px 140px 140px 120px 120px 90px 32px', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                {/* SKU Image */}
                <div
                  style={{
                    width: 52, height: 52, borderRadius: 6, overflow: 'hidden',
                    background: '#f5f5f5', border: '1px dashed #d9d9d9', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    input.onchange = (ev) => { const f = (ev.target as HTMLInputElement).files?.[0]; if (f) handleSkuImageUpload(f, idx); };
                    input.click();
                  }}
                >
                  {row.image ? (
                    <img src={row.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <PlusOutlined style={{ fontSize: 14, color: '#ccc' }} />
                  )}
                </div>
                <Input
                  placeholder="如：红色-L"
                  value={row.spec_name}
                  onChange={e => {
                    const newRows = [...skuRows];
                    newRows[idx] = { ...newRows[idx], spec_name: e.target.value };
                    setSkuRows(newRows);
                  }}
                  style={{ width: '100%' }}
                />
                <Input
                  placeholder="Seller SKU"
                  value={row.sku_code}
                  onChange={e => {
                    const newRows = [...skuRows];
                    newRows[idx] = { ...newRows[idx], sku_code: e.target.value };
                    setSkuRows(newRows);
                  }}
                  style={{ width: '100%' }}
                />
                <InputNumber
                  placeholder="成本价"
                  value={row.cost_price}
                  onChange={v => {
                    const newRows = [...skuRows];
                    newRows[idx] = { ...newRows[idx], cost_price: v || 0 };
                    setSkuRows(newRows);
                  }}
                  style={{ width: '100%' }}
                  prefix="¥"
                />
                <InputNumber
                  placeholder="售价"
                  value={row.sell_price}
                  onChange={v => {
                    const newRows = [...skuRows];
                    newRows[idx] = { ...newRows[idx], sell_price: v || 0 };
                    setSkuRows(newRows);
                  }}
                  style={{ width: '100%' }}
                  prefix="RM"
                />
                <InputNumber
                  placeholder="库存"
                  value={row.stock}
                  onChange={v => {
                    const newRows = [...skuRows];
                    newRows[idx] = { ...newRows[idx], stock: v || 0 };
                    setSkuRows(newRows);
                  }}
                  style={{ width: '100%' }}
                />
                {skuRows.length > 1 && (
                  <Button type="text" danger size="small" icon={<CloseOutlined />} onClick={() => setSkuRows(skuRows.filter((_, i) => i !== idx))} />
                )}
              </div>
            ))}
            <Button type="dashed" block size="small" onClick={() => setSkuRows([...skuRows, { key: Date.now(), spec_name: '', sku_code: '', cost_price: 0, sell_price: 0, stock: 0, image: '' }])}>
              + 添加SKU
            </Button>
          </div>

          <Divider style={{ margin: '8px 0 16px' }} />

          {/* Section 3: Box Info */}
          <div className="xzg-section-title">箱规信息</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0 12px', marginBottom: 8 }}>
            <Form.Item name="box_qty" label="每箱数量">
              <InputNumber placeholder="件数" style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="box_length" label="箱子长">
              <InputNumber placeholder="cm" style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="box_width" label="箱子宽">
              <InputNumber placeholder="cm" style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="box_height" label="箱子高">
              <InputNumber placeholder="cm" style={{ width: '100%' }} />
            </Form.Item>
          </div>

          <Divider style={{ margin: '8px 0 16px' }} />

          {/* Section 4: Shop Ownership */}
          <div className="xzg-section-title">店铺归属</div>
          {/* Header row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 32px', gap: 8, marginBottom: 6, paddingLeft: 2 }}>
            <span style={{ fontWeight: 600, color: '#333', fontSize: 13 }}>店铺名称</span>
            <span />
          </div>
          {shopRows.map((row, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 32px', gap: 8, marginBottom: 6, alignItems: 'center' }}>
              <Select
                placeholder="选择店铺"
                value={row.shop_name || undefined}
                onChange={v => {
                  const newRows = [...shopRows];
                  newRows[idx] = { ...newRows[idx], shop_name: v };
                  setShopRows(newRows);
                }}
                style={{ width: '100%' }}
                showSearch
                allowClear
                options={store.shopList.map(s => ({ value: s, label: s }))}
              />
              {shopRows.length > 1 && (
                <Button type="text" danger size="small" icon={<CloseOutlined />} onClick={() => setShopRows(shopRows.filter((_, i) => i !== idx))} />
              )}
            </div>
          ))}
          <Button type="dashed" block size="small" onClick={() => setShopRows([...shopRows, { shop_name: '', shop_price: 0 }])}>
            + 新增店铺
          </Button>
        </Form>
      </Modal>

      {/* ========== Product Detail Modal (read-only) ========== */}
      <Modal
        title="产品详情"
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        footer={<Button onClick={() => setDetailModalOpen(false)}>关闭</Button>}
        width={720}
      >
        {detailProduct && (
          <div>
            {/* Header */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
              <div style={{
                width: 100, height: 100, borderRadius: 8, overflow: 'hidden',
                background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, border: '1px solid #e8e8e8',
              }}>
                {detailProduct.image ? (
                  <img src={detailProduct.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: 40 }}>📦</span>
                )}
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#333', marginBottom: 4 }}>{detailProduct.name}</div>
                <div style={{ color: '#999', fontSize: 13, marginBottom: 8 }}>SKU数量：{detailProduct.skus?.length || 0} 个</div>
                <div style={{ color: '#999', fontSize: 13 }}>总库存：<span style={{ color: T.primary, fontWeight: 600 }}>{detailProduct.stock || 0}</span></div>
              </div>
            </div>

            <Divider style={{ margin: '0 0 16px' }} />

            {/* SKU Summary Table */}
            <div className="xzg-section-title">SKU明细</div>
      <DataTable
        dataSource={detailProduct.skus || []}
        columns={[
          {
            title: 'SKU图片', dataIndex: 'image', width: 70,
            render: (img: string) => (
              <div style={{
                width: 40, height: 40, borderRadius: 4, overflow: 'hidden',
                background: '#f5f5f5', border: '1px solid #e8e8e8',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {img ? <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 18 }}>📦</span>}
              </div>
            ),
          },
          { title: '规格名称', dataIndex: 'spec_name', width: 140 },
          { title: 'SKU编码', dataIndex: 'sku_code', width: 140 },
          { title: '采购成本', dataIndex: 'cost_price', width: 100, render: (v: number) => `¥${(v || 0).toFixed(2)}` },
          { title: '售价', dataIndex: 'sell_price', width: 100, render: (v: number) => <span style={{ color: T.primary, fontWeight: 600 }}>RM{(v || 0).toFixed(2)}</span> },
          { title: '库存', dataIndex: 'stock', width: 80 },
        ]}
        pagination={false}
        size="small"
        style={{ marginBottom: 16 }}
      />

            <Divider style={{ margin: '0 0 16px' }} />

            {/* Basic Info */}
            <div className="xzg-section-title">基础信息</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px 24px', marginBottom: 16 }}>
              <div><span className="xzg-desc-label">产品重量</span><br /><span className="xzg-desc-value">{detailProduct.weight ? `${detailProduct.weight}g` : '-'}</span></div>
              <div style={{ gridColumn: 'span 2' }}><span className="xzg-desc-label">供应商</span><br /><span className="xzg-desc-value">{detailProduct.supplier_name || '-'}</span></div>
            </div>

            {detailProduct.box_qty ? (
              <>
                <Divider style={{ margin: '0 0 16px' }} />
                <div className="xzg-section-title">箱规信息</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px 24px', marginBottom: 16 }}>
                  <div><span className="xzg-desc-label">每箱数量</span><br /><span className="xzg-desc-value">{detailProduct.box_qty} 件</span></div>
                  <div><span className="xzg-desc-label">箱子长度</span><br /><span className="xzg-desc-value">{detailProduct.box_length || '-'} cm</span></div>
                  <div><span className="xzg-desc-label">箱子宽度</span><br /><span className="xzg-desc-value">{detailProduct.box_width || '-'} cm</span></div>
                  <div><span className="xzg-desc-label">箱子高度</span><br /><span className="xzg-desc-value">{detailProduct.box_height || '-'} cm</span></div>
                </div>
              </>
            ) : null}

            {detailProduct.shops?.length > 0 && (
              <>
                <Divider style={{ margin: '0 0 16px' }} />
                <div className="xzg-section-title">店铺归属</div>
                <div>
                  {detailProduct.shops.map((s: any) => (
                    <div key={s.id} style={{ display: 'flex', gap: 24, padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}>
                      <span className="xzg-desc-label" style={{ width: 80 }}>{s.shop_name}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      {/* ========== SKU Detail Modal ========== */}
      <Modal
        title={skuModalProduct ? `${skuModalProduct.name} - SKU明细` : 'SKU明细'}
        open={skuModalOpen}
        onCancel={() => setSkuModalOpen(false)}
        width={800}
        footer={<Button onClick={() => setSkuModalOpen(false)}>关闭</Button>}
      >
        {skuModalProduct && (
          <Table
            dataSource={skuModalProduct.skus || []}
            rowKey="id"
            pagination={false}
            size="middle"
            columns={[
              {
                title: 'SKU图片',
                dataIndex: 'image',
                width: 70,
                render: (img: string) => (
                  <div style={{
                    width: 44, height: 44, borderRadius: 6, overflow: 'hidden',
                    background: '#f5f5f5', border: '1px solid #e8e8e8',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {img ? (
                      <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: 20 }}>📦</span>
                    )}
                  </div>
                ),
              },
              {
                title: '规格名称',
                dataIndex: 'spec_name',
                width: 150,
                render: (v: string) => <span style={{ fontWeight: 500 }}>{v || '-'}</span>,
              },
              { title: 'SKU编码', dataIndex: 'sku_code', width: 160 },
              {
                title: '采购成本',
                dataIndex: 'cost_price',
                width: 120,
                render: (v: number) => <span style={{ color: '#fa8c16' }}>¥{(v || 0).toFixed(2)}</span>,
              },
              {
                title: '售价',
                dataIndex: 'sell_price',
                width: 120,
                render: (v: number) => <span style={{ color: T.primary, fontWeight: 600 }}>RM{(v || 0).toFixed(2)}</span>,
              },
              {
                title: '库存',
                dataIndex: 'stock',
                width: 100,
                render: (v: number) => {
                  const color = v <= 10 ? '#ff4d4f' : v <= 50 ? '#fa8c16' : '#333';
                  return <span style={{ color, fontWeight: 600 }}>{v || 0}</span>;
                },
              },
            ]}
            summary={() => {
              const skus = skuModalProduct.skus || [];
              const totalStock = skus.reduce((s: number, item: any) => s + (item.stock || 0), 0);
              return (
                <Table.Summary fixed>
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={4}>
                      <span style={{ fontWeight: 600 }}>合计</span>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={4}>
                      <span style={{ fontWeight: 700, color: T.primary }}>{totalStock}</span>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                </Table.Summary>
              );
            }}
          />
        )}
      </Modal>

      {/* ========== TikTok Sync Modal ========== */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: `linear-gradient(135deg, #6B8CFF, ${T.primary})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 16,
            }}>
              <CloudDownloadOutlined />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>同步TikTok产品</div>
              <div style={{ fontSize: 12, color: '#999', fontWeight: 400 }}>
                从 TikTok Shop 拉取产品数据到本地
              </div>
            </div>
          </div>
        }
        open={syncModalOpen}
        onCancel={() => setSyncModalOpen(false)}
        width={560}
        footer={syncResult ? (
          <Button type="primary" onClick={() => { setSyncModalOpen(false); store.fetchProducts(); }}>
            关闭
          </Button>
        ) : (
          <Space>
            <Button onClick={() => setSyncModalOpen(false)}>取消</Button>
            <Button
              type="primary"
              icon={store.syncing ? <LoadingOutlined /> : <SyncOutlined />}
              onClick={handleSyncStart}
              loading={store.syncing}
              disabled={!selectedShopId}
              style={{ background: T.primary, borderColor: T.primary }}
            >
              开始同步
            </Button>
          </Space>
        )}
      >
        {/* Step 1: Select Shop */}
        {!syncResult && !syncError && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: '#333', marginBottom: 8 }}>
                选择要同步的 TikTok 店铺
              </div>
              <Select
                placeholder="请选择已授权的 TikTok 店铺"
                value={selectedShopId}
                onChange={v => setSelectedShopId(v)}
                style={{ width: '100%' }}
                size="large"
                showSearch
                optionFilterProp="label"
                options={store.tiktokShops.map(s => ({
                  value: s.id,
                  label: `${s.name} (${s.region || '未知地区'})`,
                }))}
                notFoundContent={
                  <div style={{ padding: 12, color: '#999', textAlign: 'center' }}>
                    暂无可同步的 TikTok 店铺，请先到
                    <a href="/shops" style={{ color: T.primary, marginLeft: 4 }}>店铺管理</a>
                    {' '}完成授权
                  </div>
                }
              />
            </div>

            {selectedShopId && (
              <div style={{
                background: '#f0f6ff', border: '1px solid #d6e4ff',
                borderRadius: 8, padding: '12px 16px',
                color: '#1e40af', fontSize: 13,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <SyncOutlined spin={store.syncing} />
                  <span style={{ fontWeight: 600 }}>即将从 TikTok 同步</span>
                </div>
                <div style={{ color: '#64748b', fontSize: 12, lineHeight: 1.6 }}>
                  同步包括：产品名称、图片、售价、库存、SKU、品牌、类目、描述等完整数据。
                  <br />已存在的产品将更新，新产品将自动创建。
                </div>
              </div>
            )}
          </div>
        )}

        {/* Syncing Progress */}
        {store.syncing && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spin size="large" />
            <div style={{ marginTop: 16, color: '#666' }}>正在从 TikTok 拉取产品数据...</div>
          </div>
        )}

        {/* Sync Error */}
        {syncError && !store.syncing && (
          <div style={{
            background: '#fff2f0', border: '1px solid #ffccc7',
            borderRadius: 8, padding: 16, marginBottom: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <CloseCircleFilled style={{ color: '#ff4d4f', fontSize: 18 }} />
              <span style={{ fontWeight: 600, color: '#cf1322' }}>同步失败</span>
            </div>
            <div style={{ color: '#666', fontSize: 13 }}>{syncError}</div>
          </div>
        )}

        {/* Sync Result */}
        {syncResult && !store.syncing && (
          <div>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12,
              marginBottom: 20,
            }}>
              <ResultCard
                icon={<PlusOutlined />}
                color={T.primary}
                bg="#eff6ff"
                label="新增产品"
                value={syncResult.created}
              />
              <ResultCard
                icon={<SyncOutlined />}
                color="#059669"
                bg="#ecfdf5"
                label="更新产品"
                value={syncResult.updated}
              />
              <ResultCard
                icon={<CheckCircleFilled />}
                color="#d97706"
                bg="#fffbeb"
                label="无变更"
                value={syncResult.skipped}
              />
            </div>

            {syncResult.errors?.length > 0 && (
              <div style={{
                background: '#fffbe6', border: '1px solid #ffe58f',
                borderRadius: 8, padding: '12px 16px',
              }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#ad6800', marginBottom: 8 }}>
                  ⚠ {syncResult.errors.length} 条错误
                </div>
                <div style={{ maxHeight: 120, overflow: 'auto' }}>
                  {syncResult.errors.map((err: string, i: number) => (
                    <div key={i} style={{ fontSize: 12, color: '#666', padding: '3px 0', borderBottom: '1px solid #f5f5f5' }}>
                      {err}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
