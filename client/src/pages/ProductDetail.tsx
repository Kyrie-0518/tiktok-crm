import React, { useEffect, useState } from 'react';
import { Card, Descriptions, Button, Modal, Form, InputNumber, Input, Space, message, Table, Empty } from 'antd';
import { EditOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useProductStore, ProductShop } from '../stores/productStore';
import { useParams, useNavigate } from 'react-router-dom';

const BRAND = '#2563eb';

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const store = useProductStore();
  const [product, setProduct] = useState<any>(null);
  const [shopEditOpen, setShopEditOpen] = useState(false);
  const [shopRows, setShopRows] = useState<ProductShop[]>([]);
  const [shopForm] = Form.useForm();

  useEffect(() => {
    if (id) loadProduct();
  }, [id]);

  const loadProduct = async () => {
    const data = await store.fetchProduct(Number(id));
    setProduct(data);
    setShopRows(data.shops?.length > 0 ? data.shops : [{ shop_name: '', shop_price: 0 }]);
  };

  const handleSaveShops = async () => {
    const validShops = shopRows.filter(s => s.shop_name);
    try {
      await store.updateProductShops(Number(id), validShops);
      setShopEditOpen(false);
      message.success('店铺信息已保存');
      loadProduct();
    } catch {
      message.error('保存失败');
    }
  };

  if (!product) {
    return <div style={{ textAlign: 'center', padding: 60 }}><Empty description="加载中..." /></div>;
  }

  const specWithMain = product.specs?.[0];
  const mainCost = specWithMain?.cost_price || 0;

  return (
    <div>
      {/* Top Nav */}
      <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => navigate('/products')} style={{ padding: 0, marginBottom: 16, color: '#666' }}>
        返回产品列表
      </Button>

      {/* Product Header */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{
            width: 120, height: 120, borderRadius: 8, overflow: 'hidden',
            background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, border: '1px solid #e8e8e8',
          }}>
            {product.image ? (
              <img src={product.image} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontSize: 48 }}>📦</span>
            )}
          </div>
          <div>
            <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 700, color: '#333' }}>{product.name}</h2>
            <span style={{ color: '#999', fontSize: 13 }}>SKU: {product.sku}</span>
          </div>
        </div>
      </Card>

      {/* Basic Info */}
      <Card title="基本信息" size="small" style={{ marginBottom: 16 }}>
        <Descriptions column={3} labelStyle={{ color: '#666', fontWeight: 500 }} contentStyle={{ color: '#333' }}>
          <Descriptions.Item label="产品售价">
            <span style={{ color: BRAND, fontWeight: 600, fontSize: 16 }}>RM{product.sell_price?.toFixed(2) || '0.00'}</span>
          </Descriptions.Item>
          <Descriptions.Item label="库存">{product.stock || 0}</Descriptions.Item>
          <Descriptions.Item label="SKU">{product.sku}</Descriptions.Item>
          <Descriptions.Item label="产品重量">{product.weight ? `${product.weight}g` : '-'}</Descriptions.Item>
          <Descriptions.Item label="成本价">
            <span style={{ color: '#fa8c16', fontWeight: 600 }}>RM{mainCost?.toFixed(2) || '0.00'}</span>
          </Descriptions.Item>
          <Descriptions.Item label="供应商">{product.supplier_name || '-'}</Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Box Info */}
      <Card title="箱规信息" size="small" style={{ marginBottom: 16 }}
        extra={product.box_qty ? (
          <span style={{ color: '#999', fontSize: 12 }}>每箱 {product.box_qty} 件</span>
        ) : null}>
        {product.box_qty ? (
          <Descriptions column={4} labelStyle={{ color: '#666', fontWeight: 500 }}>
            <Descriptions.Item label="每箱数量">{product.box_qty} 件</Descriptions.Item>
            <Descriptions.Item label="箱子长度">{product.box_length || '-'} cm</Descriptions.Item>
            <Descriptions.Item label="箱子宽度">{product.box_width || '-'} cm</Descriptions.Item>
            <Descriptions.Item label="箱子高度">{product.box_height || '-'} cm</Descriptions.Item>
          </Descriptions>
        ) : (
          <div style={{ color: '#999', padding: '8px 0' }}>暂未设置箱规信息</div>
        )}
        {product.box_remark && (
          <div style={{ marginTop: 8, color: '#666', fontSize: 13 }}>备注：{product.box_remark}</div>
        )}
      </Card>

      {/* Shop Info */}
      <Card title="店铺归属" size="small"
        extra={
          <Button type="link" icon={<EditOutlined />} onClick={() => {
            setShopRows(product.shops?.length > 0 ? product.shops.map((s: any) => ({ ...s })) : [{ shop_name: '', shop_price: 0 }]);
            setShopEditOpen(true);
          }}>
            编辑
          </Button>
        }>
        {product.shops?.length > 0 ? (
          <Table
            dataSource={product.shops}
            rowKey="id"
            size="small"
            pagination={false}
            columns={[
              { title: '店铺名称', dataIndex: 'shop_name' },
              { title: '店铺售价', dataIndex: 'shop_price', render: (v: number) => (
                <span style={{ color: BRAND, fontWeight: 600 }}>RM{(v || 0).toFixed(2)}</span>
              )},
            ]}
          />
        ) : (
          <div style={{ color: '#999', padding: '8px 0' }}>暂未绑定店铺</div>
        )}
      </Card>

      {/* Shop Edit Modal */}
      <Modal title="编辑店铺归属" open={shopEditOpen} onCancel={() => setShopEditOpen(false)} onOk={handleSaveShops} width={500}>
        {shopRows.map((row, idx) => (
          <Space key={idx} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
            <Input placeholder="店铺名称" value={row.shop_name} onChange={e => {
              const newRows = [...shopRows];
              newRows[idx] = { ...newRows[idx], shop_name: e.target.value };
              setShopRows(newRows);
            }} style={{ width: 200 }} />
            <InputNumber placeholder="售价" value={row.shop_price} onChange={v => {
              const newRows = [...shopRows];
              newRows[idx] = { ...newRows[idx], shop_price: v || 0 };
              setShopRows(newRows);
            }} style={{ width: 140 }} prefix="RM" />
            {shopRows.length > 1 && (
              <Button type="text" danger onClick={() => setShopRows(shopRows.filter((_, i) => i !== idx))}>移除</Button>
            )}
          </Space>
        ))}
        <Button type="dashed" block onClick={() => setShopRows([...shopRows, { shop_name: '', shop_price: 0 }])}>
          + 新增店铺
        </Button>
      </Modal>
    </div>
  );
}
