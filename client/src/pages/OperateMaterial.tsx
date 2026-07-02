import { useEffect, useState } from 'react';
import { Card, Row, Col, Typography, Tag, Button, Space, Input, Select, Modal, Image, Upload, message, Empty, Tooltip } from 'antd';
import {
  PictureOutlined, SearchOutlined, PlusOutlined,
  DownloadOutlined, DeleteOutlined, EyeOutlined,
  FolderOpenOutlined, FileImageOutlined, VideoCameraOutlined,
  FilterOutlined, StarOutlined, ClockCircleOutlined,
} from '@ant-design/icons';
import type { UploadFile } from 'antd';
import dayjs from 'dayjs';
import api from '../api';

const { Text } = Typography;

interface Material {
  id: number;
  name: string;
  type: string;       // image / video / text
  category: string;
  url: string;
  thumbnail?: string;
  size?: number;
  shop_name?: string;
  usage_count: number;
  tags: string[];
  created_at: string;
}

const CATEGORY_OPTIONS = [
  { value: 'product', label: '商品图' },
  { value: 'lifestyle', label: '生活场景' },
  { value: 'ad_creative', label: '广告创意' },
  { value: 'UGC', label: '用户内容' },
  { value: 'brand', label: '品牌素材' },
  { value: 'other', label: '其他' },
];

export default function OperateMaterial() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [typeFilter, setTypeFilter] = useState<string | undefined>();
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>();
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState<Material | null>(null);
  const [fileList, setFileList] = useState<UploadFile[]>([]);

  const fetchMaterials = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (searchText) params.keyword = searchText;
      if (typeFilter) params.type = typeFilter;
      if (categoryFilter) params.category = categoryFilter;
      // 尝试从素材库接口获取，加上运营素材标记
      params.source = 'operation';
      const res = await api.get('/materials', { params });
      setMaterials(res.data.list || []);
    } catch {
      // fallback：显示空列表
      setMaterials([]);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchMaterials(); }, []);

  const handleUpload = async () => {
    try {
      message.success('上传成功（功能开发中）');
      setUploadModalOpen(false);
      setFileList([]);
      fetchMaterials();
    } catch (e) { message.error('上传失败'); }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'video': return <VideoCameraOutlined style={{ fontSize: 24, color: '#8b5cf6' }} />;
      case 'image':
      default: return <FileImageOutlined style={{ fontSize: 24, color: '#3b82f6' }} />;
    }
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return '-';
    if (bytes < 1024) return bytes + 'B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
    return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
  };

  return (
    <div>
      {/* 标题 */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #06b6d4, #0891b2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(6,182,212,0.3)',
          }}>
            <FolderOpenOutlined style={{ color: '#fff', fontSize: 18 }} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1e293b' }}>运营素材</h2>
            <Text type="secondary" style={{ fontSize: 13 }}>运营活动所需的图片、视频素材库</Text>
          </div>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setUploadModalOpen(true)}>上传素材</Button>
      </div>

      {/* 统计概览 */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col><Card size="small" style={{ borderRadius: 10 }}><Space><FileImageOutlined style={{ color: '#3b82f6' }} /><span>图片 {materials.filter(m => m.type === 'image').length}</span></Space></Card></Col>
        <Col><Card size="small" style={{ borderRadius: 10 }}><Space><VideoCameraOutlined style={{ color: '#8b5cf6' }} /><span>视频 {materials.filter(m => m.type === 'video').length}</span></Space></Card></Col>
        <Col><Card size="small" style={{ borderRadius: 10 }}><Space><FolderOpenOutlined /><span>总计 {materials.length}</span></Space></Card></Col>
        <Col><Card size="small" style={{ borderRadius: 10 }}><Space><DownloadOutlined />{materials.reduce((s, m) => s + m.usage_count, 0)} 次使用</Space></Card></Col>
      </Row>

      {/* 筛选栏 */}
      <Card size="small" style={{ borderRadius: 12, marginBottom: 16, padding: '4px 0' }}>
        <Space wrap size={10}>
          <Input placeholder="搜索素材名称/标签..." prefix={<SearchOutlined />} allowClear value={searchText}
            onChange={e => setSearchText(e.target.value)} onPressEnter={fetchMaterials} style={{ width: 220 }} />
          <Select placeholder="类型" allowClear value={typeFilter} onChange={(v) => { setTypeFilter(v); fetchMaterials(); }} style={{ width: 100 }}>
            <Select.Option value="image">图片</Select.Option>
            <Select.Option value="video">视频</Select.Option>
          </Select>
          <Select placeholder="分类" allowClear value={categoryFilter} onChange={(v) => { setCategoryFilter(v); fetchMaterials(); }} style={{ width: 130 }}>
            {CATEGORY_OPTIONS.map(o => <Select.Option key={o.value} value={o.value}>{o.label}</Select.Option>)}
          </Select>
          <Button onClick={fetchMaterials}>查询</Button>
          <Button onClick={() => { setSearchText(''); setTypeFilter(undefined); setCategoryFilter(undefined); fetchMaterials(); }}>重置</Button>
        </Space>
      </Card>

      {/* 网格展示 */}
      {loading ? (
        <Card size="small" style={{ borderRadius: 12, textAlign: 'center', padding: 60 }}>加载中...</Card>
      ) : materials.length === 0 ? (
        <Card size="small" style={{ borderRadius: 12, textAlign: 'center', padding: 60 }}>
          <Empty description="暂无运营素材，点击右上角上传" />
        </Card>
      ) : (
        <Row gutter={[14, 14]}>
          {materials.map(item => (
            <Col key={item.id} xs={24} sm={12} md={8} lg={6}>
              <Card
                size="small"
                hoverable
                style={{ borderRadius: 12, overflow: 'hidden' }}
                bodyStyle={{ padding: 0 }}
                cover={
                  <div
                    style={{
                      height: 160, background: '#f1f5f9',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', position: 'relative', overflow: 'hidden',
                    }}
                    onClick={() => { setPreviewItem(item); setPreviewModalOpen(true); }}
                  >
                    {(item.url || item.thumbnail) ? (
                      <img src={item.thumbnail || item.url} alt={item.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <>{getTypeIcon(item.type)}</>
                    )}
                    {/* 类型标签 */}
                    <Tag
                      color={item.type === 'video' ? 'purple' : 'blue'}
                      style={{ position: 'absolute', top: 8, left: 8 }}
                    >
                      {item.type === 'video' ? '视频' : '图片'}
                    </Tag>
                  </div>
                }
              >
                <div style={{ padding: 10 }}>
                  <Text strong ellipsis style={{ marginBottom: 4, display: 'block' }}>{item.name}</Text>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text type="secondary" style={{ fontSize: 11.5 }}>
                      {formatSize(item.size)} · {dayjs(item.created_at).format('MM/DD')}
                    </Text>
                    <Space size={2}>
                      <Tooltip title="查看"><Button type="text" size="small" icon={<EyeOutlined />} /></Tooltip>
                      <Tooltip title="下载"><Button type="text" size="small" icon={<DownloadOutlined />} /></Tooltip>
                      <Tooltip title="删除"><Button type="text" size="small" danger icon={<DeleteOutlined />} /></Tooltip>
                    </Space>
                  </div>
                  {item.tags && item.tags.length > 0 && (
                    <div style={{ marginTop: 6 }}>
                      {item.tags.slice(0, 3).map(t => <Tag key={t} style={{ fontSize: 10, marginInlineEnd: 4 }}>{t}</Tag>)}
                    </div>
                  )}
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* 上传弹窗 */}
      <Modal title="上传运营素材" open={uploadModalOpen} onCancel={() => setUploadModalOpen(false)} onOk={handleUpload}
        okText="确认上传" cancelText="取消">
        <Space direction="vertical" style={{ width: '100%' }} size={16}>
          <div>
            <Text strong>素材类型 *</Text>
            <Select style={{ width: '100%', marginTop: 6 }} placeholder="选择类型" options={[
              {value:'image',label:'图片'}, {value:'video',label:'视频'},
            ]} />
          </div>
          <div>
            <Text strong>分类 *</Text>
            <Select style={{ width: '100%', marginTop: 6 }} placeholder="选择分类" options={CATEGORY_OPTIONS} />
          </div>
          <div>
            <Text strong>文件 *</Text>
            <Upload.Dragger multiple fileList={fileList} onChange={({ fileList: f }) => setFileList(f)}
              beforeUpload={() => false}
              accept=".jpg,.jpeg,.png,.gif,.webp,.mp4,.mov"
              style={{ marginTop: 6 }}
            >
              <p className="ant-upload-drag-icon"><PictureOutlined /></p>
              <p className="ant-upload-text">点击或拖拽文件到此处上传</p>
              <p className="ant-upload-hint">支持 JPG/PNG/GIF/WebP 图片和 MP4/MOV 视频</p>
            </Upload.Dragger>
          </div>
          <div>
            <Text strong>标签</Text>
            <Input placeholder="用逗号分隔，如：热销,夏季,促销" style={{ marginTop: 6 }} />
          </div>
        </Space>
      </Modal>

      {/* 预览弹窗 */}
      <Modal open={previewModalOpen} footer={null} onCancel={() => setPreviewModalOpen(false)}
        title={previewItem?.name || ''} width={700}>
        {previewItem && (
          <div>
            {previewItem.type === 'image' && previewItem.url && (
              <img src={previewItem.url} alt={previewItem.name} style={{ width: '100%', borderRadius: 8 }} />
            )}
            {previewItem.type === 'video' && previewItem.url && (
              <video src={previewItem.url} controls style={{ width: '100%', borderRadius: 8 }} />
            )}
            <div style={{ marginTop: 16 }}>
              <Row gutter={[16, 8]}>
                <Col span={8}><Text type="secondary">格式：</Text>{previewItem.type}</Col>
                <Col span={8}><Text type="secondary">大小：</Text>{formatSize(previewItem.size)}</Col>
                <Col span={8}><Text type="secondary">使用次数：</Text>{previewItem.usage_count}</Col>
                <Col span={24}><Text type="secondary">上传时间：</Text>{dayjs(previewItem.created_at).format('YYYY-MM-DD HH:mm:ss')}</Col>
                <Col span={24}><Text type="secondary">标签：</Text>{previewItem.tags?.join(', ') || '-'}</Col>
              </Row>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
