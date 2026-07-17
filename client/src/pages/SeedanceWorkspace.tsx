import React, { useEffect, useRef, useState } from 'react';
import {
  Button, Input, Select, Modal, message, Tooltip, Tag, Empty, Spin, Drawer, Badge, Progress,
  Typography, Space, Collapse, Dropdown, Row, Col,
} from 'antd';
import {
  VideoCameraOutlined, PictureOutlined, FileImageOutlined, CloudUploadOutlined,
  ThunderboltOutlined, HistoryOutlined, ReloadOutlined, DownloadOutlined,
  CheckCircleFilled, CloseCircleFilled, ClockCircleOutlined, LoadingOutlined,
  PlayCircleOutlined, AppstoreOutlined, PlusOutlined,
  BulbOutlined, EditOutlined, CloseOutlined,
  FireOutlined, GiftOutlined, SmileOutlined, StarOutlined,
  AppstoreAddOutlined, DownOutlined, SearchOutlined, DeleteOutlined,
  SaveOutlined, ShareAltOutlined, UnorderedListOutlined,
} from '@ant-design/icons';
import api from '../api';
import { PageHeader } from '../components/design-system';

const { TextArea } = Input;
const { Text } = Typography;

// ═══ Tokens ═══
const T = {
  primary: '#7B61FF', primaryLight: '#F5F3FF',
  primaryGradient: 'linear-gradient(135deg, #8b5cf6, #7B61FF)',
  bg: '#f5f3f0', cardBg: '#FFFFFF', border: '#EEF1F6',
  textPrimary: '#172033', textSecondary: '#64748B', textTertiary: '#94A3B8',
  success: '#22C55E', warning: '#F59E0B', error: '#EF4444', info: '#3B82F6',
};

// ═══ Types ═══
interface Product { id: number; sku: string; name: string; image: string; sell_price: number; }
interface Video { id: number; title: string; video_url: string; thumbnail_url: string; prompt: string; model: string; resolution: string; duration: number; aspect_ratio: string; status: string; product_name?: string; product_image?: string; created_at: string; token_usage?: number; time_cost?: number; }

// ═══ Constants ═══
const HOT_TEMPLATES = [
  { label: '商品介绍', icon: <GiftOutlined />, color: '#7B61FF', prompt: '专业商品展示镜头：产品居中，背景纯净柔和，灯光突出产品质感，慢速 360° 旋转展示，质感高清。' },
  { label: '节日促销', icon: <FireOutlined />, color: '#EF4444', prompt: '节日促销场景：红色和金色元素，礼盒爆炸特效，烟花背景，文字动画出现，节奏明快有张力。' },
  { label: '开箱视频', icon: <AppstoreOutlined />, color: '#22C55E', prompt: '网红开箱风格：俯拍桌面，双手优雅拆开精美包装，渐次展示产品细节，反应惊喜自然。' },
  { label: '品牌故事', icon: <StarOutlined />, color: '#F59E0B', prompt: '电影级品牌片：航拍城市天际线 → 工匠细节特写 → 用户使用场景 → logo 收尾，节奏舒缓大气。' },
  { label: '真人口播', icon: <SmileOutlined />, color: '#3B82F6', prompt: '真人口播风格：主播正对镜头，背景虚化，自然亲切地介绍产品卖点，节奏贴近日常对话。' },
  { label: '种草测评', icon: <ThunderboltOutlined />, color: '#8B5CF6', prompt: '种草测评风格：手持产品近景演示，配合场景化使用画面，强调使用前后对比和体验感。' },
];

// ═══ Main ═══
export default function SeedanceWorkspace() {
  // ── State ──
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [productLoading, setProductLoading] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);

  const [prompt, setPrompt] = useState('');
  const [modelOption, setModelOption] = useState('doubao-seedance-2-0-260128');
  const [resolution, setResolution] = useState('720p');
  const [aspectRatio, setAspectRatio] = useState('9:16');
  const [duration, setDuration] = useState(5);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [productMaterial, setProductMaterial] = useState<{ url: string; name: string } | null>(null);
  const [referenceMaterial, setReferenceMaterial] = useState<{ url: string; name: string } | null>(null);

  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');
  const [progress, setProgress] = useState(0);
  const [previewVideo, setPreviewVideo] = useState<Video | null>(null);
  const [lastGenStats, setLastGenStats] = useState<{ duration: number; tokens: number } | null>(null);

  const [availableModels, setAvailableModels] = useState<any[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [aiOptimizeLoading, setAiOptimizeLoading] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);

  // ── Init ──
  useEffect(() => {
    api.get('/video-models/configs/available').then((res) => {
      setAvailableModels(res.data?.configs || []);
      const c = res.data?.configs;
      if (c && c.length > 0) { setModelOption(c[0].model_type); }
    }).catch(() => {});
    loadVideos();
  }, []);

  const loadVideos = async () => {
    try { const r = await api.get('/seedance/videos', { params: { limit: 50 } }); setVideos(r.data?.videos || r.data || []); }
    catch {}
  };

  // ── Product search ──
  const searchProducts = async (kw: string) => {
    setProductLoading(true);
    try { const r = await api.get('/products', { params: { keyword: kw, limit: 30 } }); setProducts(r.data || []); }
    catch { setProducts([]); }
    finally { setProductLoading(false); }
  };

  useEffect(() => { if (productModalOpen && !products.length) searchProducts(''); }, [productModalOpen]);

  const onSelectProduct = (p: Product) => {
    setSelectedProduct(p);
    setProductMaterial({ url: p.image, name: p.name });
    setProductModalOpen(false);
    if (!prompt) setPrompt(`专业商品展示：${p.name}，产品居中，背景柔和干净，灯光突出产品质感，节奏舒缓大气。`);
  };

  // ── Upload ──
  const uploadImage = async (file: File): Promise<string> => {
    const fd = new FormData(); fd.append('file', file);
    const r = await api.post('/upload/image', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    return r.data?.url || r.data?.path || URL.createObjectURL(file);
  };
  const onUploadProduct = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    try { const u = await uploadImage(f); setProductMaterial({ url: u, name: f.name }); } catch { message.error('上传失败'); }
  };
  const onUploadRef = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    try { const u = await uploadImage(f); setReferenceMaterial({ url: u, name: f.name }); } catch { message.error('上传失败'); }
  };

  // ── Template ──
  const applyTemplate = (t: typeof HOT_TEMPLATES[0]) => { setPrompt(t.prompt); setTemplateModalOpen(false); message.success('已应用模板'); };

  // ── AI optimize ──
  const aiOptimize = async () => {
    if (!prompt.trim()) return message.warning('请先输入 Prompt');
    setAiOptimizeLoading(true);
    try { const r = await api.post('/ai/optimize-prompt', { prompt, product: selectedProduct?.name }); if (r.data?.optimized) { setPrompt(r.data.optimized); message.success('AI 已优化'); } } catch { setPrompt(p => p + '。镜头推进平滑，光线柔和自然，电影级质感。'); message.info('已应用本地优化'); }
    finally { setAiOptimizeLoading(false); }
  };

  // ── Generate ──
  const handleGenerate = async () => {
    if (!prompt.trim()) return message.warning('请输入视频创意');
    if (generating) return;
    setGenerating(true); setGenError(''); setProgress(0); setPreviewVideo(null);
    const t0 = Date.now();
    try {
      const pTimer = setInterval(() => setProgress(v => Math.min(v + Math.random() * 8, 92)), 800);
      const r = await api.post('/seedance/generate', {
        prompt, product_id: selectedProduct?.id, product_image: productMaterial?.url, reference_image: referenceMaterial?.url,
        model: modelOption, resolution, duration, aspect_ratio: aspectRatio, count: 1, voice_enabled: true,
      });
      clearInterval(pTimer); setProgress(95);
      const vid = r.data?.video_id || r.data?.id;
      if (vid) { await poll(vid); } else if (r.data?.video_url) {
        setPreviewVideo({ id: r.data.id || Date.now(), title: selectedProduct?.name || 'AI 视频', video_url: r.data.video_url, thumbnail_url: r.data.thumbnail_url || '', prompt, model: modelOption, resolution, duration, aspect_ratio: aspectRatio, status: 'completed', created_at: new Date().toISOString(), token_usage: r.data.token_usage, product_name: selectedProduct?.name });
        setProgress(100); setLastGenStats({ duration: (Date.now() - t0) / 1000, tokens: r.data.token_usage || 0 });
      }
    } catch (e: any) { setGenError(e.response?.data?.error || e.message || '生成失败'); }
    finally { setGenerating(false); }
  };

  const poll = async (vid: number) => {
    for (let i = 0; i < 60; i++) {
      try { const r = await api.get(`/seedance/videos/${vid}`); const v = r.data?.video || r.data; if (v.status === 'completed' || v.video_url) { setPreviewVideo(v); setProgress(100); setLastGenStats({ duration: 0, tokens: v.token_usage || 0 }); loadVideos(); return; } if (v.status === 'failed') { setGenError(v.error || '生成失败'); return; } if (v.progress) setProgress(v.progress); } catch {}
      await new Promise(r => setTimeout(r, 5000));
    }
    setGenError('超时，请查看历史记录');
  };

  const handleDownload = (v: Video) => { const a = document.createElement('a'); a.href = v.video_url; a.download = v.title || 'video.mp4'; a.target = '_blank'; a.click(); };

  // ═══ Render ═══
  return (
    <div style={{ background: T.bg, minHeight: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}>

      {/* ── Header ── */}
      <div style={{ background: T.cardBg, padding: '12px 24px', borderBottom: `1px solid ${T.border}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <PageHeader title="AI 视频生成" description="文生视频 · 图生视频 · AI 创作" icon={<VideoCameraOutlined />} />
        <Space>
          <Badge count={videos.length} size="small"><Button icon={<HistoryOutlined />} onClick={() => setHistoryOpen(true)}>历史记录</Button></Badge>
        </Space>
      </div>

      {/* ── Top Bar: Product / Mode / Model ── */}
      <div style={{ background: T.cardBg, padding: '12px 24px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 20, flexShrink: 0 }}>
        <InlineField label="商品">
          {selectedProduct ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: T.primaryLight, borderRadius: 8, padding: '4px 12px' }}>
              <img src={selectedProduct.image} style={{ width: 22, height: 22, borderRadius: 4 }} />
              <Text ellipsis style={{ maxWidth: 120, fontSize: 12, fontWeight: 600, color: T.primary }}>{selectedProduct.name}</Text>
              <Button type="text" size="small" icon={<CloseOutlined />} onClick={() => { setSelectedProduct(null); setProductMaterial(null); }} />
            </div>
          ) : (
            <Button size="small" type="dashed" icon={<AppstoreAddOutlined />} onClick={() => setProductModalOpen(true)} style={{ borderRadius: 6 }}>选择商品</Button>
          )}
        </InlineField>
        <div style={{ width: 1, height: 24, background: T.border }} />
        <InlineField label="模型">
          <Select size="small" value={modelOption} onChange={setModelOption} variant="borderless" style={{ minWidth: 110 }}
            options={availableModels.length > 0 ? availableModels.map(m => ({ value: m.model_type, label: m.model_info?.name || m.model_type })) : [{ value: 'doubao-seedance-2-0-260128', label: 'Seedance V2' }, { value: 'kling-2.1', label: 'Kling 2.1' }]} />
        </InlineField>
      </div>

      {/* ── Content: Prompt (60%) + Preview (40%) ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* ── LEFT: Prompt 创作区 ── */}
        <div style={{ width: '60%', display: 'flex', flexDirection: 'column', borderRight: `1px solid ${T.border}`, background: T.cardBg }}>
          {/* Upload Row */}
          <div style={{ padding: '12px 24px', display: 'flex', gap: 8, borderBottom: `1px solid ${T.border}` }}>
            <UploadBtn label="上传商品图" onChange={onUploadProduct} preview={productMaterial} onClear={() => setProductMaterial(null)} />
            <UploadBtn label="上传参考图" onChange={onUploadRef} preview={referenceMaterial} onClear={() => setReferenceMaterial(null)} />
            <div style={{ flex: 1 }} />
            <Button size="small" type="text" icon={<UnorderedListOutlined />} onClick={() => setTemplateModalOpen(true)} style={{ color: T.textTertiary }}>模板</Button>
          </div>

          {/* Prompt Area */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px 24px 12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <Text style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}>💡 Prompt 创意</Text>
              <Space size={4}>
                <Button size="small" type="text" icon={<BulbOutlined />} loading={aiOptimizeLoading} onClick={aiOptimize} style={{ color: T.primary }}>AI 优化</Button>
              </Space>
            </div>
            <TextArea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder={'请输入视频创意描述…\n\n描述越详细，AI 生成的视频越接近预期。\n例如：商品展示（产品居中、柔和灯光、慢速旋转）\n    场景带货（阳光草地、模特试穿、自然笑容）\n    品牌宣传（航拍城市、特写细节、Logo收尾）'}
              style={{ borderRadius: 10, fontSize: 13, lineHeight: 1.75, flex: 1, resize: 'none', border: `1px solid ${T.border}` }}
              maxLength={2000}
            />
          </div>

          {/* Compact Params Row */}
          <div style={{ padding: '8px 24px', borderTop: `1px solid ${T.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ParamTag label={modelOption} icon={<VideoCameraOutlined />} />
              <ParamTag label={aspectRatio} />
              <ParamTag label={resolution} />
              <ParamTag label={`${duration} 秒`} />
              <Button type="link" size="small" onClick={() => setShowAdvanced(!showAdvanced)} icon={<DownOutlined rotate={showAdvanced ? 180 : 0} />}
                style={{ color: T.textTertiary, fontSize: 12, padding: 0 }}>{showAdvanced ? '收起' : '更多参数'}</Button>
            </div>
            {showAdvanced && (
              <Row gutter={[12, 8]} style={{ marginTop: 12, padding: 10, background: '#F8FAFC', borderRadius: 8 }}>
                <Col span={8}><F label="模型"><Select size="small" value={modelOption} onChange={setModelOption} style={{ width: '100%' }} options={availableModels.length > 0 ? availableModels.map(m => ({ value: m.model_type, label: m.model_info?.name || m.model_type })) : [{ value: 'doubao-seedance-2-0-260128', label: 'Seedance V2' }, { value: 'kling-2.1', label: 'Kling 2.1' }]} /></F></Col>
                <Col span={5}><F label="时长"><Select size="small" value={duration} onChange={setDuration} style={{ width: '100%' }} options={[5, 10, 15].map(d => ({ value: d, label: `${d} 秒` }))} /></F></Col>
                <Col span={6}><F label="比例"><Select size="small" value={aspectRatio} onChange={setAspectRatio} style={{ width: '100%' }} options={[{ value: '9:16', label: '9:16' }, { value: '16:9', label: '16:9' }, { value: '1:1', label: '1:1' }]} /></F></Col>
                <Col span={5}><F label="分辨率"><Select size="small" value={resolution} onChange={setResolution} style={{ width: '100%' }} options={['480p', '720p', '1080p'].map(r => ({ value: r, label: r }))} /></F></Col>
              </Row>
            )}
          </div>

          {/* Generate Button */}
          <div style={{ padding: '12px 24px 16px', borderTop: `1px solid ${T.border}` }}>
            <Button type="primary" size="large" block loading={generating} disabled={!prompt.trim()}
              onClick={handleGenerate} icon={generating ? <LoadingOutlined /> : <ThunderboltOutlined />}
              style={{ height: 52, borderRadius: 12, fontSize: 16, fontWeight: 700, background: T.primaryGradient, border: 'none', boxShadow: '0 4px 16px rgba(123,97,255,0.35)' }}>
              {generating ? `生成中 ${Math.round(progress)}%` : '立即生成视频'}
            </Button>
          </div>
        </div>

        {/* ── RIGHT: Preview ── */}
        <div style={{ width: '40%', display: 'flex', flexDirection: 'column', minWidth: 380, background: '#0F172A' }}>
          <div style={{ padding: '12px 20px', background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 600 }}>🎬 生成结果</Text>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', minHeight: 300 }}>
            {generating ? (
              <div style={{ textAlign: 'center', color: '#fff' }}>
                <LoadingOutlined style={{ fontSize: 48, color: T.primary, marginBottom: 16 }} />
                <Progress percent={Math.round(progress)} strokeColor={T.primary} style={{ width: 220, marginBottom: 8 }} />
                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>AI 正在生成...</Text>
              </div>
            ) : genError ? (
              <div style={{ textAlign: 'center', padding: 24 }}>
                <CloseCircleFilled style={{ fontSize: 48, color: T.error, marginBottom: 12 }} />
                <Text style={{ color: '#fff', display: 'block', marginBottom: 12 }}>{genError}</Text>
                <Button size="small" onClick={handleGenerate}>重试</Button>
              </div>
            ) : previewVideo ? (
              <div style={{ width: '100%', height: '100%' }}>
                <video ref={videoRef} src={previewVideo.video_url} controls style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </div>
            ) : (
              <Empty image={<VideoCameraOutlined style={{ fontSize: 48, color: 'rgba(255,255,255,0.1)' }} />}
                description={<span style={{ color: 'rgba(255,255,255,0.25)' }}>点击「立即生成」开始创作</span>} />
            )}
          </div>
          {previewVideo && (
            <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.02)' }}>
              <Space size={8} style={{ width: '100%', justifyContent: 'space-between' }}>
                <Button ghost size="small" icon={<DownloadOutlined />} onClick={() => handleDownload(previewVideo)}>下载</Button>
                <Button ghost size="small" icon={<ReloadOutlined />} onClick={handleGenerate}>重新生成</Button>
                <Button ghost size="small" icon={<EditOutlined />}>继续编辑</Button>
                <Button ghost size="small" icon={<SaveOutlined />}>保存素材</Button>
              </Space>
              {lastGenStats && (
                <div style={{ marginTop: 10, padding: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 6, display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
                  <span>模型: <strong style={{ color: '#fff' }}>{previewVideo.model}</strong></span>
                  <span>分辨率: <strong style={{ color: '#fff' }}>{previewVideo.resolution}</strong></span>
                  <span>时长: <strong style={{ color: '#fff' }}>{previewVideo.duration}s</strong></span>
                  <span>Token: <strong style={{ color: '#fff' }}>{previewVideo.token_usage || 0}</strong></span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Product Modal ── */}
      <Modal title="选择产品" open={productModalOpen} onCancel={() => setProductModalOpen(false)} footer={null} width={540}>
        <Input.Search allowClear onSearch={searchProducts} onChange={e => setProductSearch(e.target.value)} style={{ marginBottom: 12 }} />
        <Spin spinning={productLoading}>
          <div style={{ maxHeight: 400, overflow: 'auto' }}>
            {products.length === 0 ? <Empty description="未找到产品" /> : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {products.map(p => (
                  <div key={p.id} onClick={() => onSelectProduct(p)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, borderRadius: 8, border: `1px solid ${T.border}`, cursor: 'pointer' }}>
                    <img src={p.image} style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover' }} />
                    <div style={{ flex: 1, minWidth: 0 }}><Text ellipsis style={{ fontSize: 12, fontWeight: 500, display: 'block' }}>{p.name}</Text><Text style={{ fontSize: 11, color: T.textTertiary }}>{p.sku}</Text></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Spin>
      </Modal>

      {/* ── Template Modal ── */}
      <Modal title="✨ 推荐模板" open={templateModalOpen} onCancel={() => setTemplateModalOpen(false)} footer={null} width={520}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {HOT_TEMPLATES.map(t => (
            <div key={t.label} onClick={() => applyTemplate(t)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 10, background: '#F8FAFC', cursor: 'pointer', transition: 'all .15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${t.color}12`; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#F8FAFC'; }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: `${t.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.color, fontSize: 16 }}>{t.icon}</div>
              <div style={{ flex: 1 }}><Text style={{ fontSize: 13, fontWeight: 600 }}>{t.label}</Text><Text style={{ fontSize: 11, color: T.textTertiary, display: 'block', maxHeight: 28, overflow: 'hidden' }}>{t.prompt.slice(0, 50)}…</Text></div>
            </div>
          ))}
        </div>
      </Modal>

      {/* ── History Drawer ── */}
      <Drawer title="历史记录" placement="right" width={400} open={historyOpen} onClose={() => setHistoryOpen(false)}>
        {videos.length === 0 ? <Empty description="暂无历史" /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {videos.map(v => (
              <div key={v.id} onClick={() => { setPreviewVideo(v); setHistoryOpen(false); }}
                style={{ display: 'flex', gap: 10, padding: 10, borderRadius: 8, border: `1px solid ${T.border}`, cursor: 'pointer' }}>
                <img src={v.thumbnail_url || v.product_image || ''} style={{ width: 64, height: 64, borderRadius: 6, objectFit: 'cover', background: T.bg }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text ellipsis style={{ fontSize: 12, fontWeight: 500, display: 'block' }}>{v.title || '未命名'}</Text>
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

// ═══ Sub Components ═══

function InlineField({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <Text style={{ fontSize: 12, color: T.textTertiary, whiteSpace: 'nowrap' }}>{label}</Text>
    {children}
  </div>;
}

function UploadBtn({ label, onChange, preview, onClear }: { label: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; preview?: { url: string; name: string } | null; onClear: () => void }) {
  return (
    <div style={{ position: 'relative' }}>
      <input type="file" accept="image/*,video/*" onChange={onChange} style={{ display: 'none' }} id={`up-${label}`} />
      {preview ? (
        <div style={{ position: 'relative', borderRadius: 6, overflow: 'hidden', width: 40, height: 40, border: `1px solid ${T.border}` }}>
          <img src={preview.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <Button size="small" type="text" icon={<CloseOutlined style={{ fontSize: 10 }} />} onClick={e => { e.stopPropagation(); onClear(); }}
            style={{ position: 'absolute', top: 0, right: 0, padding: 0, background: 'rgba(255,255,255,0.9)' }} />
        </div>
      ) : (
        <Tooltip title={label}>
          <label htmlFor={`up-${label}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: 6, border: `1px dashed ${T.border}`, cursor: 'pointer', color: T.textTertiary, fontSize: 14 }}>
            <PlusOutlined />
          </label>
        </Tooltip>
      )}
    </div>
  );
}

function ParamTag({ label, icon }: { label: string; icon?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, background: '#F1F5F9', fontSize: 12, fontWeight: 500, color: T.textPrimary }}>
      {icon}
      {label}
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div style={{ fontSize: 11, color: T.textTertiary, marginBottom: 4 }}>{label}</div>{children}</div>;
}
