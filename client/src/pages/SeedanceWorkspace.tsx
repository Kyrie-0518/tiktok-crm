import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  Button, Card, Input, Select, Modal, message, Tooltip, Tag, Empty, Spin, Drawer, Badge, Progress,
  Typography, Row, Col, Space, Collapse, Segmented,
} from 'antd';
import {
  VideoCameraOutlined, PictureOutlined, FileImageOutlined, CloudUploadOutlined,
  ThunderboltOutlined, HistoryOutlined, ReloadOutlined, DownloadOutlined,
  CheckCircleFilled, CloseCircleFilled, ClockCircleOutlined, LoadingOutlined,
  PlayCircleOutlined, AppstoreOutlined, StarOutlined, PlusOutlined,
  BulbOutlined, SendOutlined, EditOutlined, CloseOutlined,
  FireOutlined, GiftOutlined, SmileOutlined,
  ArrowUpOutlined, DeleteOutlined,
} from '@ant-design/icons';
import api from '../api';
import { PageHeader } from '../components/design-system';

const { TextArea } = Input;
const { Text } = Typography;
const { Panel } = Collapse;

// ═══════════════════════════════════════════════════
// Design Tokens
// ═══════════════════════════════════════════════════
const T = {
  primary: '#7B61FF',
  primaryLight: '#F5F3FF',
  primaryGradient: 'linear-gradient(135deg, #8b5cf6, #7B61FF)',
  bg: '#f5f3f0',
  cardBg: '#FFFFFF',
  border: '#EEF1F6',
  borderStrong: '#DCE3F0',
  textPrimary: '#172033',
  textSecondary: '#64748B',
  textTertiary: '#94A3B8',
  success: '#22C55E',
  successBg: '#F0FDF4',
  warning: '#F59E0B',
  warningBg: '#FFFBEB',
  error: '#EF4444',
  errorBg: '#FEF2F2',
  info: '#3B82F6',
  infoBg: '#EFF6FF',
  cardRadius: 12,
  cardShadow: '0 1px 3px rgba(0,0,0,0.04)',
};

// ═══════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════
interface Product {
  id: number; sku: string; name: string; image: string;
  sell_price: number; weight?: number; category?: string;
}

interface Video {
  id: number;
  title: string;
  video_url: string;
  thumbnail_url: string;
  prompt: string;
  model: string;
  resolution: string;
  duration: number;
  aspect_ratio: string;
  status: string;
  product_name?: string;
  product_image?: string;
  created_at: string;
  token_usage?: number;
  time_cost?: number;
}

interface GenConfig {
  model: string;
  resolution: string;
  duration: number;
  aspectRatio: string;
  count: number;
  voiceEnabled: boolean;
}

// ═══════════════════════════════════════════════════
// 热门模板
// ═══════════════════════════════════════════════════
const HOT_TEMPLATES = [
  { key: 'product', label: '商品介绍', icon: <GiftOutlined />, color: '#7B61FF', bg: '#F5F3FF',
    prompt: '专业商品展示镜头：产品居中，背景纯净柔和，灯光突出产品质感，慢速 360° 旋转展示，质感高清。' },
  { key: 'promo', label: '节日促销', icon: <FireOutlined />, color: '#EF4444', bg: '#FEF2F2',
    prompt: '节日促销场景：红色和金色元素，礼盒爆炸特效，烟花背景，文字动画出现，节奏明快有张力。' },
  { key: 'unbox', label: '开箱视频', icon: <AppstoreOutlined />, color: '#22C55E', bg: '#F0FDF4',
    prompt: '网红开箱风格：俯拍桌面，双手优雅拆开精美包装，渐次展示产品细节，反应惊喜自然。' },
  { key: 'brand', label: '品牌故事', icon: <StarOutlined />, color: '#F59E0B', bg: '#FFFBEB',
    prompt: '电影级品牌片：航拍城市天际线 → 工匠细节特写 → 用户使用场景 → logo 收尾，节奏舒缓大气。' },
  { key: 'talking', label: '真人口播', icon: <SmileOutlined />, color: '#3B82F6', bg: '#EFF6FF',
    prompt: '真人口播风格：主播正对镜头，背景虚化，自然亲切地介绍产品卖点，节奏贴近日常对话。' },
  { key: 'tutorial', label: '种草测评', icon: <BulbOutlined />, color: '#8B5CF6', bg: '#F5F3FF',
    prompt: '种草测评风格：手持产品近景演示，配合场景化使用画面，强调使用前后对比和体验感。' },
];

// ═══════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════
export default function SeedanceWorkspace() {
  // 状态
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [productLoading, setProductLoading] = useState(false);

  const [prompt, setPrompt] = useState('');
  const [config, setConfig] = useState<GenConfig>({
    model: 'doubao-seedance-2-0-260128',
    resolution: '720p',
    duration: 5,
    aspectRatio: '9:16',
    count: 1,
    voiceEnabled: true,
  });

  const [productMaterial, setProductMaterial] = useState<{ url: string; name: string } | null>(null);
  const [referenceMaterial, setReferenceMaterial] = useState<{ url: string; name: string } | null>(null);
  const [recommendMaterials, setRecommendMaterials] = useState<{ url: string; name: string; cover?: string }[]>([]);

  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');
  const [progress, setProgress] = useState(0);
  const [previewVideo, setPreviewVideo] = useState<Video | null>(null);
  const [lastGenStats, setLastGenStats] = useState<{ duration: number; tokens: number } | null>(null);

  const [availableModels, setAvailableModels] = useState<any[]>([]);
  const [currentApiInfo, setCurrentApiInfo] = useState<{ api_name?: string; api_id?: number } | null>(null);

  const [videos, setVideos] = useState<Video[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  const [aiOptimizeLoading, setAiOptimizeLoading] = useState(false);
  const [activeMode, setActiveMode] = useState<'product' | 'free' | 'image'>('product');

  const videoRef = useRef<HTMLVideoElement>(null);
  const pendingVideoIdRef = useRef<number | null>(null);
  const pollTimerRef = useRef<any>(null);

  // 加载可用模型
  useEffect(() => {
    api.get('/video-models/configs/available').then((res) => {
      setAvailableModels(res.data?.configs || []);
      if (res.data?.configs?.[0]) {
        const first = res.data.configs[0];
        setConfig((c) => ({ ...c, model: first.model_type }));
        setCurrentApiInfo({
          api_id: undefined,
          api_name: first.model_info?.name || first.model_type,
        });
      }
    }).catch(() => {});
    loadVideos();
  }, []);

  // 加载视频列表
  const loadVideos = async () => {
    try {
      const res = await api.get('/seedance/videos', { params: { limit: 50 } });
      setVideos(res.data?.videos || res.data || []);
    } catch {}
  };

  // 搜索产品
  const searchProducts = async (kw: string) => {
    setProductLoading(true);
    try {
      const res = await api.get('/products', { params: { keyword: kw, limit: 30 } });
      setProducts(res.data || []);
    } catch {
      setProducts([]);
    } finally {
      setProductLoading(false);
    }
  };

  useEffect(() => {
    if (productModalOpen && !products.length) searchProducts('');
  }, [productModalOpen]);

  // 选择产品后自动填充 Prompt
  const onSelectProduct = (p: Product) => {
    setSelectedProduct(p);
    setProductMaterial({ url: p.image, name: p.name });
    setProductModalOpen(false);
    // 自动填充推荐 Prompt
    if (!prompt) {
      setPrompt(`专业商品展示：${p.name}，产品居中，背景柔和干净，灯光突出产品质感，节奏舒缓大气。`);
    }
  };

  // 上传产品图
  const uploadImage = async (file: File): Promise<string> => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await api.post('/upload/image', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    return res.data?.url || res.data?.path || URL.createObjectURL(file);
  };

  const onUploadProductImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadImage(file);
      setProductMaterial({ url, name: file.name });
    } catch { message.error('上传失败'); }
  };

  const onUploadReference = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadImage(file);
      setReferenceMaterial({ url, name: file.name });
    } catch { message.error('上传失败'); }
  };

  // 应用模板
  const applyTemplate = (tpl: typeof HOT_TEMPLATES[0]) => {
    setPrompt(tpl.prompt);
    message.success(`已应用「${tpl.label}」模板`);
  };

  // AI 优化 Prompt
  const aiOptimizePrompt = async () => {
    if (!prompt.trim()) return message.warning('请先输入 Prompt');
    setAiOptimizeLoading(true);
    try {
      const res = await api.post('/ai/optimize-prompt', { prompt, product: selectedProduct?.name });
      const optimized = res.data?.optimized || res.data?.prompt;
      if (optimized) {
        setPrompt(optimized);
        message.success('AI 已优化 Prompt');
      }
    } catch {
      // 离线回退：简单加镜头和光线描述
      setPrompt((p) => `${p}。镜头推进平滑，光线柔和自然，色调温暖，景深虚化背景，电影级质感。`);
      message.info('已应用本地优化');
    } finally {
      setAiOptimizeLoading(false);
    }
  };

  // 生成视频
  const handleGenerate = async () => {
    if (!prompt.trim()) return message.warning('请输入视频创意描述');
    if (generating) return;

    setGenerating(true);
    setGenError('');
    setProgress(0);
    setPreviewVideo(null);

    const startTime = Date.now();
    try {
      // 进度模拟
      const progressTimer = setInterval(() => {
        setProgress((p) => Math.min(p + Math.random() * 8, 92));
      }, 800);

      const res = await api.post('/seedance/generate', {
        prompt,
        product_id: selectedProduct?.id,
        product_image: productMaterial?.url,
        reference_image: referenceMaterial?.url,
        model: config.model,
        resolution: config.resolution,
        duration: config.duration,
        aspect_ratio: config.aspectRatio,
        count: config.count,
        voice_enabled: config.voiceEnabled,
      });

      clearInterval(progressTimer);
      setProgress(95);

      const videoId = res.data?.video_id || res.data?.id;
      if (videoId) {
        // 轮询
        pendingVideoIdRef.current = videoId;
        await pollVideoStatus(videoId);
      } else if (res.data?.video_url) {
        // 同步返回
        const newVideo: Video = {
          id: res.data.id || Date.now(),
          title: selectedProduct?.name || 'AI 生成视频',
          video_url: res.data.video_url,
          thumbnail_url: res.data.thumbnail_url || productMaterial?.url || '',
          prompt, model: config.model, resolution: config.resolution,
          duration: config.duration, aspect_ratio: config.aspectRatio,
          status: 'completed', created_at: new Date().toISOString(),
          token_usage: res.data.token_usage, time_cost: res.data.time_cost,
          product_name: selectedProduct?.name, product_image: productMaterial?.url,
        };
        setPreviewVideo(newVideo);
        setProgress(100);
        setLastGenStats({ duration: (Date.now() - startTime) / 1000, tokens: newVideo.token_usage || 0 });
      }
    } catch (e: any) {
      setGenError(e.response?.data?.error || e.message || '生成失败');
    } finally {
      setGenerating(false);
    }
  };

  // 轮询视频状态
  const pollVideoStatus = async (videoId: number) => {
    const maxAttempts = 60; // 5 分钟
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const res = await api.get(`/seedance/videos/${videoId}`);
        const v = res.data?.video || res.data;
        if (v.status === 'completed' || v.status === 'success' || v.video_url) {
          setPreviewVideo(v);
          setProgress(100);
          setLastGenStats({ duration: 0, tokens: v.token_usage || 0 });
          loadVideos();
          return;
        }
        if (v.status === 'failed' || v.status === 'error') {
          setGenError(v.error || '生成失败');
          return;
        }
        const reportedProgress = v.progress || 0;
        if (reportedProgress > 0) setProgress(reportedProgress);
      } catch {}
      await new Promise((r) => setTimeout(r, 5000));
    }
    setGenError('生成超时，请稍后在历史记录中查看');
  };

  useEffect(() => {
    return () => { if (pollTimerRef.current) clearTimeout(pollTimerRef.current); };
  }, []);

  // 下载视频
  const handleDownload = (v: Video) => {
    const a = document.createElement('a');
    a.href = v.video_url;
    a.download = v.title || 'video.mp4';
    a.target = '_blank';
    a.click();
  };

  return (
    <div style={{ background: T.bg, minHeight: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}>
      {/* ═══ Header ═══ */}
      <div style={{ background: T.cardBg, padding: '16px 24px', borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <PageHeader
            title="AI 视频生成"
            description="文生视频 · 图生视频 · AI 智能创作"
            icon={<VideoCameraOutlined />}
          />
          <Space>
            <Badge count={videos.length} size="small" offset={[-4, 4]}>
              <Button icon={<HistoryOutlined />} onClick={() => setHistoryOpen(true)}>
                历史记录
              </Button>
            </Badge>
            {currentApiInfo && (
              <Tag style={{ borderRadius: 6, padding: '2px 10px', background: T.primaryLight, color: T.primary, border: 'none', fontWeight: 500 }}>
                {currentApiInfo.api_name}
              </Tag>
            )}
          </Space>
        </div>
      </div>

      {/* ═══ 三栏布局 ═══ */}
      <div style={{ flex: 1, display: 'flex', gap: 12, padding: 12, overflow: 'hidden' }}>
        {/* ──────── 左栏：素材区 (20%) ──────── */}
        <div style={{ width: '20%', minWidth: 260, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'auto' }}>
          {/* 素材上传 */}
          <Card size="small" title={<span style={{ fontSize: 13, fontWeight: 600 }}>📦 素材</span>}
            style={{ borderRadius: T.cardRadius, border: `1px solid ${T.border}` }}
            bodyStyle={{ padding: 12 }}>
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <Tooltip title="点击上传商品主图">
                <UploadBox
                  label="商品主图"
                  material={productMaterial}
                  onUpload={onUploadProductImage}
                  onClear={() => setProductMaterial(null)}
                />
              </Tooltip>
              <Tooltip title="点击上传参考图/视频">
                <UploadBox
                  label="参考素材"
                  material={referenceMaterial}
                  onUpload={onUploadReference}
                  onClear={() => setReferenceMaterial(null)}
                />
              </Tooltip>
            </Space>
          </Card>

          {/* 产品选择 */}
          <Card size="small" title={<span style={{ fontSize: 13, fontWeight: 600 }}>🏷️ 产品信息</span>}
            style={{ borderRadius: T.cardRadius, border: `1px solid ${T.border}` }}
            bodyStyle={{ padding: 12 }}>
            {selectedProduct ? (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <img src={selectedProduct.image} style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text ellipsis style={{ fontSize: 12, fontWeight: 600, color: T.textPrimary, display: 'block' }}>{selectedProduct.name}</Text>
                  <Text style={{ fontSize: 11, color: T.textTertiary }}>SKU: {selectedProduct.sku}</Text>
                </div>
                <Button size="small" type="text" icon={<CloseOutlined />} onClick={() => setSelectedProduct(null)} />
              </div>
            ) : (
              <Button block icon={<PlusOutlined />} onClick={() => setProductModalOpen(true)} style={{ borderRadius: 8 }}>
                选择产品
              </Button>
            )}
          </Card>

          {/* 热门模板 */}
          <Card size="small" title={<span style={{ fontSize: 13, fontWeight: 600 }}>✨ 热门模板</span>}
            style={{ borderRadius: T.cardRadius, border: `1px solid ${T.border}` }}
            bodyStyle={{ padding: 10 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {HOT_TEMPLATES.map((tpl) => (
                <div key={tpl.key} onClick={() => applyTemplate(tpl)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, background: tpl.bg, cursor: 'pointer', transition: 'all 0.15s' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = 'translateX(2px)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = ''; }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: tpl.color, fontSize: 14 }}>
                    {tpl.icon}
                  </div>
                  <Text style={{ fontSize: 12, fontWeight: 500, color: tpl.color }}>{tpl.label}</Text>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* ──────── 中栏：创作区 (45%) ──────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
          {/* 创作模式切换 */}
          <Card size="small" style={{ borderRadius: T.cardRadius, border: `1px solid ${T.border}` }} bodyStyle={{ padding: '8px 16px' }}>
            <Segmented
              value={activeMode}
              onChange={(v: any) => setActiveMode(v)}
              options={[
                { label: '🎁 商品带货', value: 'product' },
                { label: '✨ 自由创作', value: 'free' },
                { label: '🖼️ 图生视频', value: 'image' },
              ]}
              style={{ fontSize: 13 }}
            />
          </Card>

          {/* Prompt 编辑器 */}
          <Card size="small" title={<span style={{ fontSize: 13, fontWeight: 600 }}>💡 Prompt 创意</span>}
            extra={
              <Space size={4}>
                <Button size="small" type="text" icon={<BulbOutlined spin={aiOptimizeLoading} />} loading={aiOptimizeLoading} onClick={aiOptimizePrompt}>
                  AI 优化
                </Button>
              </Space>
            }
            style={{ borderRadius: T.cardRadius, border: `1px solid ${T.border}`, flex: 1 }}
            bodyStyle={{ padding: 12, display: 'flex', flexDirection: 'column' }}>
            <TextArea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="请输入视频创意描述…&#10;&#10;例如：&#10;• 主体：商品或人物&#10;• 场景：背景/光线/色调&#10;• 镜头：运镜/角度/节奏&#10;• 风格：电影感/治愈/活力"
              autoSize={{ minRows: 10, maxRows: 16 }}
              style={{ borderRadius: 8, fontSize: 13, lineHeight: 1.7, flex: 1, resize: 'none' }}
              maxLength={2000}
              showCount
            />
          </Card>

          {/* 视频参数 */}
          <Card size="small" title={<span style={{ fontSize: 13, fontWeight: 600 }}>⚙️ 视频参数</span>}
            style={{ borderRadius: T.cardRadius, border: `1px solid ${T.border}` }}
            bodyStyle={{ padding: 14 }}>
            <Row gutter={[12, 8]}>
              <Col span={8}>
                <Field label="模型">
                  <Select value={config.model} onChange={(v) => setConfig({ ...config, model: v })} size="small" style={{ width: '100%' }}
                    options={availableModels.length > 0
                      ? availableModels.map(m => ({ value: m.model_type, label: m.model_info?.name || m.model_type }))
                      : [{ value: 'doubao-seedance-2-0-260128', label: 'Seedance V2' }, { value: 'kling-2.1', label: 'Kling 2.1' }]}
                  />
                </Field>
              </Col>
              <Col span={5}>
                <Field label="时长">
                  <Select value={config.duration} onChange={(v) => setConfig({ ...config, duration: v })} size="small" style={{ width: '100%' }}
                    options={[5, 10, 15].map(s => ({ value: s, label: `${s} 秒` }))} />
                </Field>
              </Col>
              <Col span={6}>
                <Field label="比例">
                  <Select value={config.aspectRatio} onChange={(v) => setConfig({ ...config, aspectRatio: v })} size="small" style={{ width: '100%' }}
                    options={[{ value: '9:16', label: '9:16 竖屏' }, { value: '16:9', label: '16:9 横屏' }, { value: '1:1', label: '1:1 方形' }]} />
                </Field>
              </Col>
              <Col span={5}>
                <Field label="分辨率">
                  <Select value={config.resolution} onChange={(v) => setConfig({ ...config, resolution: v })} size="small" style={{ width: '100%' }}
                    options={['480p', '720p', '1080p'].map(r => ({ value: r, label: r }))} />
                </Field>
              </Col>
            </Row>
          </Card>

          {/* 生成按钮 */}
          <Button
            type="primary"
            size="large"
            block
            loading={generating}
            disabled={!prompt.trim()}
            onClick={handleGenerate}
            icon={generating ? <LoadingOutlined /> : <ThunderboltOutlined />}
            style={{
              height: 52,
              borderRadius: 12,
              fontSize: 16,
              fontWeight: 700,
              background: T.primaryGradient,
              border: 'none',
              boxShadow: '0 4px 16px rgba(123,97,255,0.35)',
            }}
          >
            {generating ? `生成中 ${Math.round(progress)}%` : '立即生成视频'}
          </Button>
        </div>

        {/* ──────── 右栏：结果区 (35%) ──────── */}
        <div style={{ width: '35%', minWidth: 360, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Card size="small" title={<span style={{ fontSize: 13, fontWeight: 600 }}>🎬 生成结果</span>}
            style={{ borderRadius: T.cardRadius, border: `1px solid ${T.border}`, flex: 1, display: 'flex', flexDirection: 'column' }}
            bodyStyle={{ padding: 0, flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, position: 'relative', background: '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 280, borderRadius: '0 0 12px 12px', overflow: 'hidden' }}>
              {generating ? (
                <div style={{ textAlign: 'center', color: '#fff' }}>
                  <LoadingOutlined style={{ fontSize: 48, color: T.primary, marginBottom: 16 }} />
                  <Progress percent={Math.round(progress)} strokeColor={T.primary} style={{ width: 240, marginBottom: 8 }} />
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>AI 正在生成视频，请稍候...</Text>
                </div>
              ) : genError ? (
                <div style={{ textAlign: 'center', color: '#fff', padding: 24 }}>
                  <CloseCircleFilled style={{ fontSize: 48, color: T.error, marginBottom: 12 }} />
                  <Text style={{ color: '#fff', display: 'block', marginBottom: 12 }}>{genError}</Text>
                  <Button size="small" onClick={handleGenerate}>重试</Button>
                </div>
              ) : previewVideo ? (
                <div style={{ width: '100%', height: '100%' }}>
                  <video ref={videoRef} src={previewVideo.video_url} controls style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </div>
              ) : (
                <Empty image={<VideoCameraOutlined style={{ fontSize: 48, color: 'rgba(255,255,255,0.2)' }} />} description={<span style={{ color: 'rgba(255,255,255,0.4)' }}>点击「立即生成」开始创作</span>} />
              )}
            </div>
            {previewVideo && (
              <div style={{ padding: 14, borderTop: `1px solid ${T.border}` }}>
                <Space style={{ width: '100%', justifyContent: 'space-between' }} size={6}>
                  <Button size="small" icon={<DownloadOutlined />} onClick={() => handleDownload(previewVideo)}>下载</Button>
                  <Button size="small" icon={<ReloadOutlined />} onClick={handleGenerate}>重新生成</Button>
                  <Button size="small" icon={<EditOutlined />}>继续编辑</Button>
                  <Button size="small" icon={<AppstoreOutlined />}>保存素材</Button>
                </Space>
                {lastGenStats && (
                  <div style={{ marginTop: 12, padding: 10, background: T.bg, borderRadius: 8, display: 'flex', justifyContent: 'space-between', fontSize: 11, color: T.textSecondary }}>
                    <span>模型: <strong style={{ color: T.textPrimary }}>{previewVideo.model}</strong></span>
                    <span>分辨率: <strong style={{ color: T.textPrimary }}>{previewVideo.resolution}</strong></span>
                    <span>时长: <strong style={{ color: T.textPrimary }}>{previewVideo.duration}s</strong></span>
                    <span>Token: <strong style={{ color: T.textPrimary }}>{previewVideo.token_usage || 0}</strong></span>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* ═══ 产品选择 Modal ═══ */}
      <Modal title="选择产品" open={productModalOpen} onCancel={() => setProductModalOpen(false)} footer={null} width={640}>
        <Input.Search
          placeholder="搜索产品名称或 SKU"
          allowClear
          onSearch={searchProducts}
          onChange={(e) => setProductSearch(e.target.value)}
          style={{ marginBottom: 12 }}
        />
        <Spin spinning={productLoading}>
          <div style={{ maxHeight: 400, overflow: 'auto' }}>
            {products.length === 0 ? (
              <Empty description="未找到产品" />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                {products.map((p) => (
                  <div key={p.id} onClick={() => onSelectProduct(p)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, borderRadius: 8, border: `1px solid ${T.border}`, cursor: 'pointer' }}>
                    <img src={p.image} style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text ellipsis style={{ fontSize: 12, fontWeight: 500, color: T.textPrimary, display: 'block' }}>{p.name}</Text>
                      <Text style={{ fontSize: 11, color: T.textTertiary }}>SKU: {p.sku}</Text>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Spin>
      </Modal>

      {/* ═══ 历史记录 Drawer ═══ */}
      <Drawer title="历史记录" placement="right" width={420} open={historyOpen} onClose={() => setHistoryOpen(false)}>
        {videos.length === 0 ? (
          <Empty description="暂无历史" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {videos.map((v) => (
              <div key={v.id} style={{ display: 'flex', gap: 10, padding: 10, borderRadius: 8, border: `1px solid ${T.border}`, cursor: 'pointer' }}
                onClick={() => { setPreviewVideo(v); setHistoryOpen(false); }}>
                <img src={v.thumbnail_url || v.product_image || ''} style={{ width: 64, height: 64, borderRadius: 6, objectFit: 'cover', background: T.bg }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text ellipsis style={{ fontSize: 12, fontWeight: 500, color: T.textPrimary, display: 'block' }}>{v.title || '未命名'}</Text>
                  <Text style={{ fontSize: 11, color: T.textTertiary, display: 'block' }}>{v.model} · {v.duration}s</Text>
                  <Text style={{ fontSize: 11, color: T.textTertiary }}>{new Date(v.created_at).toLocaleString()}</Text>
                </div>
                {v.status === 'completed' ? <CheckCircleFilled style={{ color: T.success }} /> : v.status === 'failed' ? <CloseCircleFilled style={{ color: T.error }} /> : <ClockCircleOutlined style={{ color: T.warning }} />}
              </div>
            ))}
          </div>
        )}
      </Drawer>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// Sub Components
// ═══════════════════════════════════════════════════
function UploadBox({ label, material, onUpload, onClear }: {
  label: string;
  material: { url: string; name: string } | null;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
}) {
  return (
    <div style={{ position: 'relative' }}>
      <input type="file" accept="image/*,video/*" onChange={onUpload} style={{ display: 'none' }} id={`upload-${label}`} />
      {material ? (
        <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: `1px solid ${T.border}` }}>
          <img src={material.url} style={{ width: '100%', height: 80, objectFit: 'cover' }} />
          <Button size="small" type="text" icon={<CloseOutlined />} onClick={onClear}
            style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(255,255,255,0.9)' }} />
        </div>
      ) : (
        <label htmlFor={`upload-${label}`}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: 32, borderRadius: 8, border: `1px dashed ${T.borderStrong}`, cursor: 'pointer', fontSize: 12, color: T.textSecondary }}>
          <PlusOutlined />
          {label}
        </label>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: T.textTertiary, marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  );
}
