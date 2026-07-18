import React, { useEffect, useRef, useState } from 'react';
import {
  Button, Input, Select, Modal, message, Tooltip, Tag, Empty, Spin, Drawer, Badge, Progress,
  Typography, Space,
} from 'antd';
import {
  VideoCameraOutlined, PictureOutlined, FileImageOutlined,
  ThunderboltOutlined, HistoryOutlined, ReloadOutlined, DownloadOutlined,
  CheckCircleFilled, CloseCircleFilled, ClockCircleOutlined, LoadingOutlined,
  PlayCircleOutlined, AppstoreOutlined, PlusOutlined,
  BulbOutlined, EditOutlined, CloseOutlined,
  FireOutlined, GiftOutlined, SmileOutlined, StarOutlined,
  AppstoreAddOutlined, DownOutlined, SaveOutlined, UnorderedListOutlined,
} from '@ant-design/icons';
import api from '../api';
import { PageHeader } from '../components/design-system';

const { TextArea } = Input;
const { Text } = Typography;

// ═══ Tokens ═══
const T = {
  primary: '#7B61FF', primaryLight: '#F5F3FF', primaryHover: '#6A4FEF',
  primaryGradient: 'linear-gradient(135deg, #8b5cf6, #7B61FF)',
  bg: '#f5f3f0', cardBg: '#FFFFFF', border: '#EEF1F6',
  textPrimary: '#172033', textSecondary: '#64748B', textTertiary: '#94A3B8',
  success: '#22C55E', warning: '#F59E0B', error: '#EF4444', info: '#3B82F6',
  maxWidth: 900,
};

// ═══ Types ═══
interface Product { id: number; sku: string; name: string; image: string; sell_price: number; }
interface Video { id: number; title: string; video_url: string; thumbnail_url: string; prompt: string; model: string; resolution: string; duration: number; aspect_ratio: string; status: string; product_name?: string; product_image?: string; created_at: string; token_usage?: number; time_cost?: number; }

// ═══ Constants ═══
const HOT_TEMPLATES = [
  { label: '商品介绍', icon: <GiftOutlined />, color: '#7B61FF', prompt: '专业商品展示镜头：产品居中，背景纯净柔和，灯光突出产品质感，慢速 360° 旋转展示，质感高清。' },
  { label: '节日促销', icon: <FireOutlined />, color: '#EF4444', prompt: '节日促销场景：红色和金色元素，礼盒爆炸特效，烟花背景，文字动画出现，节奏明快有张力。' },
  { label: '开箱测评', icon: <AppstoreOutlined />, color: '#22C55E', prompt: '网红开箱风格：俯拍桌面，双手优雅拆开精美包装，渐次展示产品细节，反应惊喜自然。' },
  { label: '品牌故事', icon: <StarOutlined />, color: '#F59E0B', prompt: '电影级品牌片：航拍城市天际线 → 工匠细节特写 → 用户使用场景 → logo 收尾，节奏舒缓大气。' },
  { label: '真人口播', icon: <SmileOutlined />, color: '#3B82F6', prompt: '真人口播风格：主播正对镜头，背景虚化，自然亲切地介绍产品卖点，节奏贴近日常对话。' },
  { label: '种草测评', icon: <ThunderboltOutlined />, color: '#8B5CF6', prompt: '种草测评风格：手持产品近景演示，配合场景化使用画面，强调使用前后对比和体验感。' },
];

const AI_SUGGESTIONS = [
  { label: 'AI 优化', icon: <BulbOutlined />, desc: '丰富细节，提升画面感' },
  { label: '生成脚本', icon: <EditOutlined />, desc: '自动扩展为分镜脚本' },
  { label: '英文翻译', icon: <StarOutlined />, desc: '翻译为英文 Prompt' },
];

// ═══ Main ═══
export default function SeedanceWorkspace() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
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
  const [aiLoading, setAiLoading] = useState(false);
  const [resultExpanded, setResultExpanded] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);

  // ── Init ──
  useEffect(() => {
    api.get('/video-models/configs/available').then((r) => {
      setAvailableModels(r.data?.configs || []);
      const c = r.data?.configs;
      if (c && c.length > 0) setModelOption(c[0].model_type);
    }).catch(() => {});
    loadVideos();
  }, []);

  const loadVideos = async () => {
    try { const r = await api.get('/seedance/videos', { params: { limit: 50 } }); setVideos(r.data?.videos || r.data || []); }
    catch {}
  };

  // ── Product ──
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
  const applyTemplate = (t: typeof HOT_TEMPLATES[0]) => { setPrompt(t.prompt); setTemplateModalOpen(false); };

  // ── AI ──
  const aiAction = async (action: string) => {
    if (!prompt.trim()) return message.warning('请先输入 Prompt');
    setAiLoading(true);
    try {
      const r = await api.post('/ai/optimize-prompt', { prompt, action, product: selectedProduct?.name });
      if (r.data?.optimized) { setPrompt(r.data.optimized); message.success('AI 已优化'); }
    } catch {
      if (action === '翻译') setPrompt(p => p + '\n\n[English] Professional product showcase: center composition, soft lighting, slow rotation, cinema-grade quality.');
      else setPrompt(p => p + '。镜头推进平滑，光线柔和自然，色调温暖，景深虚化背景，电影级质感。');
      message.info('已应用本地优化');
    }
    finally { setAiLoading(false); }
  };

  // ── Generate ──
  const handleGenerate = async () => {
    if (!prompt.trim()) return message.warning('请输入视频创意');
    if (generating) return;
    setGenerating(true); setGenError(''); setProgress(0); setPreviewVideo(null); setResultExpanded(true);
    const t0 = Date.now();
    try {
      const pTimer = setInterval(() => setProgress(v => Math.min(v + Math.random() * 8, 92)), 700);
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
    <div style={{ background: T.bg, minHeight: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* ── Header ── */}
      <div style={{ width: '100%', background: T.cardBg, padding: '12px 24px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <PageHeader title="AI 视频生成" description="文生视频 · 图生视频 · AI 创作" icon={<VideoCameraOutlined />} />
        <Badge count={videos.length} size="small"><Button icon={<HistoryOutlined />} onClick={() => setHistoryOpen(true)}>历史记录</Button></Badge>
      </div>

      {/* ── Main Content: max 900px centered ── */}
      <div style={{ width: '100%', maxWidth: T.maxWidth, flex: 1, display: 'flex', flexDirection: 'column', padding: '20px 24px', gap: 16 }}>

        {/* ── Row 1: Product & Model Bar ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {selectedProduct ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: T.primaryLight, borderRadius: 8, padding: '4px 10px' }}>
              <img src={selectedProduct.image} style={{ width: 22, height: 22, borderRadius: 4 }} />
              <Text ellipsis style={{ maxWidth: 100, fontSize: 12, fontWeight: 600, color: T.primary }}>{selectedProduct.name}</Text>
              <Button type="text" size="small" icon={<CloseOutlined />} onClick={() => { setSelectedProduct(null); setProductMaterial(null); setPrompt(''); }} />
            </div>
          ) : (
            <Button size="small" type="dashed" icon={<AppstoreAddOutlined />} onClick={() => setProductModalOpen(true)} style={{ borderRadius: 6 }}>选择商品</Button>
          )}
          <Select size="small" value={modelOption} onChange={setModelOption} variant="borderless" style={{ minWidth: 110, fontWeight: 600, color: T.textPrimary }}
            options={availableModels.length > 0 ? availableModels.map(m => ({ value: m.model_type, label: m.model_info?.name || m.model_type })) : [{ value: 'doubao-seedance-2-0-260128', label: 'Seedance V2' }, { value: 'kling-2.1', label: 'Kling 2.1' }]} />
        </div>

        {/* ── Row 2: Upload Buttons + Template ── */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <UploadBtn label="上传商品图" onChange={onUploadProduct} preview={productMaterial} onClear={() => setProductMaterial(null)} />
          <UploadBtn label="上传参考图" onChange={onUploadRef} preview={referenceMaterial} onClear={() => setReferenceMaterial(null)} />
          <div style={{ flex: 1 }} />
          <Button size="small" type="text" onClick={() => setTemplateModalOpen(true)} style={{ color: T.textTertiary, fontSize: 12 }}>✨ 模板</Button>
        </div>

        {/* ── Row 3: PROMPT — The Star ── */}
        <div style={{
          background: T.cardBg, borderRadius: 16, border: `2px solid ${resultExpanded ? T.border : T.primaryLight}`,
          boxShadow: resultExpanded ? 'none' : '0 4px 24px rgba(123,97,255,0.12), 0 0 0 1px rgba(123,97,255,0.08)',
          transition: 'box-shadow 0.3s, border-color 0.3s',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          <div style={{ padding: '20px 24px 12px' }}>
            <Text style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary, display: 'block', marginBottom: 12 }}>💡 描述你想生成的视频</Text>
            <TextArea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder={'描述越详细，AI 生成的视频越接近预期…\n\n例如：马来西亚 TikTok 风扇带货视频，真人口播风格，卧室场景，展示风扇静音和风力强劲，自然光线，节奏轻快'}
              autoSize={{ minRows: 6, maxRows: 12 }}
              style={{ borderRadius: 10, fontSize: 14, lineHeight: 1.8, resize: 'none', border: 'none', boxShadow: 'none', padding: 0 }}
              variant="borderless"
              maxLength={4000}
            />
          </div>

          {/* AI Actions Row */}
          <div style={{ padding: '0 24px 12px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {AI_SUGGESTIONS.map(a => (
              <Button key={a.label} size="small" type="text" icon={a.icon} loading={aiLoading && a.label === 'AI 优化'}
                onClick={() => aiAction(a.label === '英文翻译' ? '翻译' : '优化')}
                style={{ borderRadius: 20, fontSize: 12, color: T.textSecondary, padding: '4px 14px', background: '#F8FAFC' }}>
                {a.label}
              </Button>
            ))}
          </div>

          {/* Tags Row */}
          <div style={{ padding: '0 24px', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <ParamTag label={modelOption} icon={<VideoCameraOutlined />} />
            <ParamTag label={aspectRatio} />
            <ParamTag label={resolution} />
            <ParamTag label={`${duration} 秒`} />
            <Button type="link" size="small" onClick={() => setShowAdvanced(!showAdvanced)} icon={<DownOutlined rotate={showAdvanced ? 180 : 0} />}
              style={{ color: T.textTertiary, fontSize: 12, padding: '0 4px' }} />
          </div>

          {showAdvanced && (
            <div style={{ padding: '12px 24px', borderTop: `1px solid ${T.border}`, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <AF label="模型"><Select size="small" value={modelOption} onChange={setModelOption} style={{ width: 130 }} options={availableModels.length > 0 ? availableModels.map(m => ({ value: m.model_type, label: m.model_info?.name || m.model_type })) : [{ value: 'doubao-seedance-2-0-260128', label: 'Seedance V2' }, { value: 'kling-2.1', label: 'Kling 2.1' }]} /></AF>
              <AF label="时长"><Select size="small" value={duration} onChange={setDuration} style={{ width: 80 }} options={[5, 10, 15].map(d => ({ value: d, label: `${d} 秒` }))} /></AF>
              <AF label="比例"><Select size="small" value={aspectRatio} onChange={setAspectRatio} style={{ width: 90 }} options={[{ value: '9:16', label: '9:16' }, { value: '16:9', label: '16:9' }, { value: '1:1', label: '1:1' }]} /></AF>
              <AF label="分辨率"><Select size="small" value={resolution} onChange={setResolution} style={{ width: 90 }} options={['480p', '720p', '1080p'].map(r => ({ value: r, label: r }))} /></AF>
            </div>
          )}

          {/* Template Chips */}
          <div style={{ padding: '8px 24px', display: 'flex', gap: 6, flexWrap: 'wrap', borderTop: `1px solid ${T.border}` }}>
            {HOT_TEMPLATES.slice(0, 4).map(t => (
              <div key={t.label} onClick={() => { setPrompt(t.prompt); }}
                style={{ padding: '3px 10px', borderRadius: 16, background: '#F8FAFC', cursor: 'pointer', fontSize: 11, color: T.textSecondary, fontWeight: 500, border: `1px solid transparent`, transition: 'all .15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = t.color; e.currentTarget.style.color = t.color; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.color = T.textSecondary; }}>
                {t.label}
              </div>
            ))}
            <div onClick={() => setTemplateModalOpen(true)} style={{ padding: '3px 10px', borderRadius: 16, background: 'transparent', cursor: 'pointer', fontSize: 11, color: T.textTertiary }}>更多 →</div>
          </div>
        </div>

        {/* ── Row 4: BIG Generate Button ── */}
        <Button
          type="primary"
          size="large"
          block
          loading={generating}
          disabled={!prompt.trim()}
          onClick={handleGenerate}
          icon={generating ? <LoadingOutlined /> : <ThunderboltOutlined />}
          style={{
            height: 56, borderRadius: 14, fontSize: 17, fontWeight: 700, letterSpacing: '0.5px',
            background: T.primaryGradient, border: 'none',
            boxShadow: '0 6px 24px rgba(123,97,255,0.40), 0 2px 8px rgba(123,97,255,0.25)',
            transform: 'scale(1)',
            transition: 'all .2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(123,97,255,0.50), 0 4px 12px rgba(123,97,255,0.30)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(123,97,255,0.40), 0 2px 8px rgba(123,97,255,0.25)'; }}
        >
          {generating ? `正在生成 AI 视频 · ${Math.round(progress)}%` : '⚡ 立即生成视频'}
        </Button>

        {/* ── Row 5: Result (inline, grows from below) ── */}
        {(resultExpanded) && (
          <div style={{
            background: previewVideo ? '#0F172A' : T.cardBg,
            borderRadius: 16, border: `1px solid ${previewVideo ? 'transparent' : T.border}`,
            overflow: 'hidden', transition: 'all 0.3s',
          }}>
            {generating ? (
              <div style={{ textAlign: 'center', padding: '60px 24px' }}>
                <LoadingOutlined spin style={{ fontSize: 40, color: T.primary, marginBottom: 16 }} />
                <Progress percent={Math.round(progress)} strokeColor={{ from: '#8b5cf6', to: '#7B61FF' }} style={{ maxWidth: 320, margin: '0 auto 12px' }} />
                <Text style={{ color: T.textSecondary, fontSize: 14 }}>AI 正在生成视频，预计 45-60 秒…</Text>
              </div>
            ) : genError ? (
              <div style={{ textAlign: 'center', padding: '40px 24px' }}>
                <CloseCircleFilled style={{ fontSize: 36, color: T.error, marginBottom: 12 }} />
                <Text style={{ color: T.textPrimary, display: 'block', marginBottom: 12, fontWeight: 500 }}>{genError}</Text>
                <Button size="small" onClick={handleGenerate} style={{ borderRadius: 8 }}>重新生成</Button>
              </div>
            ) : previewVideo ? (
              <>
                <div style={{ position: 'relative', minHeight: 360, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <video ref={videoRef} src={previewVideo.video_url} controls poster={previewVideo.thumbnail_url}
                    style={{ width: '100%', maxHeight: 500, objectFit: 'contain' }} />
                </div>
                <div style={{ padding: '14px 20px', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <Space size={6}>
                    <Button ghost size="small" icon={<DownloadOutlined />} onClick={() => handleDownload(previewVideo)} style={{ borderRadius: 8 }}>下载</Button>
                    <Button ghost size="small" icon={<ReloadOutlined />} onClick={handleGenerate} style={{ borderRadius: 8 }}>重新生成</Button>
                    <Button ghost size="small" icon={<EditOutlined />} style={{ borderRadius: 8 }}>继续编辑</Button>
                    <Button ghost size="small" icon={<SaveOutlined />} style={{ borderRadius: 8 }}>保存素材</Button>
                  </Space>
                  {lastGenStats && (
                    <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
                      <span>模型: <strong style={{ color: '#fff' }}>{previewVideo.model || modelOption}</strong></span>
                      <span>时长: <strong style={{ color: '#fff' }}>{previewVideo.duration}s</strong></span>
                      <span>Token: <strong style={{ color: '#fff' }}>{previewVideo.token_usage || 0}</strong></span>
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </div>
        )}
      </div>

      {/* ── Product Modal ── */}
      <Modal title="选择产品" open={productModalOpen} onCancel={() => setProductModalOpen(false)} footer={null} width={540}>
        <Input.Search allowClear onSearch={searchProducts} onChange={() => {}} style={{ marginBottom: 12 }} />
        <Spin spinning={productLoading}>
          <div style={{ maxHeight: 400, overflow: 'auto' }}>
            {products.length === 0 ? <Empty description="未找到产品" /> : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {products.map(p => (
                  <div key={p.id} onClick={() => onSelectProduct(p)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, borderRadius: 8, border: `1px solid ${T.border}`, cursor: 'pointer' }}>
                    <img src={p.image} style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover' }} />
                    <div style={{ flex: 1 }}><Text ellipsis style={{ fontSize: 12, fontWeight: 500, display: 'block' }}>{p.name}</Text><Text style={{ fontSize: 11, color: T.textTertiary }}>{p.sku}</Text></div>
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
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 10, background: '#F8FAFC', cursor: 'pointer' }}
              onMouseEnter={e => { e.currentTarget.style.background = `${t.color}12`; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#F8FAFC'; }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: `${t.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.color, fontSize: 16 }}>{t.icon}</div>
              <div><Text style={{ fontSize: 13, fontWeight: 600 }}>{t.label}</Text><Text style={{ fontSize: 11, color: T.textTertiary, display: 'block', maxHeight: 28, overflow: 'hidden' }}>{t.prompt.slice(0, 50)}…</Text></div>
            </div>
          ))}
        </div>
      </Modal>

      {/* ── History Drawer ── */}
      <Drawer title="历史记录" placement="right" width={400} open={historyOpen} onClose={() => setHistoryOpen(false)}>
        {videos.length === 0 ? <Empty description="暂无历史" /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {videos.map(v => (
              <div key={v.id} onClick={() => { setPreviewVideo(v); setResultExpanded(true); setHistoryOpen(false); }}
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

function UploadBtn({ label, onChange, preview, onClear }: { label: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; preview?: { url: string } | null; onClear: () => void }) {
  return (
    <div style={{ position: 'relative' }}>
      <input type="file" accept="image/*,video/*" onChange={onChange} style={{ display: 'none' }} id={`up-${label}`} />
      {preview ? (
        <div style={{ position: 'relative', borderRadius: 6, overflow: 'hidden', width: 40, height: 40, border: `1px solid ${T.border}` }}>
          <img src={preview.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <Button size="small" type="text" icon={<CloseOutlined style={{ fontSize: 10 }} />} onClick={e => { e.stopPropagation(); onClear(); }} style={{ position: 'absolute', top: 0, right: 0, padding: 0, background: 'rgba(255,255,255,0.9)' }} />
        </div>
      ) : (
        <Tooltip title={label}>
          <label htmlFor={`up-${label}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 6, border: `1px dashed ${T.border}`, cursor: 'pointer', fontSize: 11, color: T.textSecondary }}>
            <PlusOutlined style={{ fontSize: 12 }} />{label}
          </label>
        </Tooltip>
      )}
    </div>
  );
}

function ParamTag({ label, icon }: { label: string; icon?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 5, background: '#F1F5F9', fontSize: 11, fontWeight: 500, color: T.textPrimary }}>
      {icon}{label}
    </div>
  );
}

function AF({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
    <Text style={{ fontSize: 11, color: T.textTertiary, whiteSpace: 'nowrap' }}>{label}</Text>
    {children}
  </div>;
}
