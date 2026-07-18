import React, { useEffect, useRef, useState } from 'react';
import { Button, Input, Select, Modal, message, Tooltip, Tag, Empty, Spin, Drawer, Badge, Progress, Typography, Space, Segmented } from 'antd';
import {
  VideoCameraOutlined, PictureOutlined, FileImageOutlined, ThunderboltOutlined, HistoryOutlined,
  ReloadOutlined, DownloadOutlined, CheckCircleFilled, CloseCircleFilled, ClockCircleOutlined,
  LoadingOutlined, PlayCircleOutlined, AppstoreOutlined, PlusOutlined, BulbOutlined, EditOutlined,
  CloseOutlined, FireOutlined, GiftOutlined, SmileOutlined, StarOutlined,
  AppstoreAddOutlined, DownOutlined, SaveOutlined, UnorderedListOutlined,
  GlobalOutlined, ExpandOutlined, SoundOutlined, StopOutlined, EyeOutlined,
} from '@ant-design/icons';
import api from '../api';
import { PageHeader } from '../components/design-system';

const { TextArea } = Input;
const { Text } = Typography;

/* ═════════════════════════════════════════ Design Tokens ═════════════════════════════════════════ */
const C = {
  primary: '#6E56FF', primaryHover: '#7C6BFF', primaryLight: '#F4F2FF',
  bg: '#F7F8FA', cardBg: '#FFFFFF',
  border: '#EAECF0', borderLight: '#F1F3F5',
  textPrimary: '#172033', textSecondary: '#64748B', textTertiary: '#94A3B8',
  success: '#22C55E', warning: '#F59E0B', error: '#EF4444', info: '#3B82F6',
  shadow: '0 4px 16px rgba(15,23,42,0.06)',
  radius: 12, maxW: 960,
};

/* ═════════════════════════════════════════ Types ════════════════════════════════════════════════ */
interface Product { id: number; sku: string; name: string; image: string; sell_price: number; }
interface Video { id: number; title: string; video_url: string; thumbnail_url: string; prompt: string; model: string; resolution: string; duration: number; aspect_ratio: string; status: string; product_name?: string; product_image?: string; created_at: string; token_usage?: number; time_cost?: number; }

/* ═════════════════════════════════════════ Constants ════════════════════════════════════════════ */
const TEMPLATES = [
  { label: '商品介绍', icon: <GiftOutlined />, color: '#6E56FF', prompt: '专业商品展示镜头：产品居中，背景纯净柔和，灯光突出产品质感，慢速 360° 旋转展示，质感高清。' },
  { label: '种草测评', icon: <ThunderboltOutlined />, color: '#8B5CF6', prompt: '种草测评风格：手持产品近景演示，配合场景化使用画面，强调使用前后对比和体验感。' },
  { label: '节日促销', icon: <FireOutlined />, color: '#EF4444', prompt: '节日促销场景：红色和金色元素，礼盒爆炸特效，烟花背景，文字动画出现，节奏明快有张力。' },
  { label: '品牌故事', icon: <StarOutlined />, color: '#F59E0B', prompt: '电影级品牌片：航拍城市天际线 → 工匠细节特写 → 用户使用场景 → logo 收尾，节奏舒缓大气。' },
  { label: '开箱测评', icon: <AppstoreOutlined />, color: '#22C55E', prompt: '网红开箱风格：俯拍桌面，双手优雅拆开精美包装，渐次展示产品细节，反应惊喜自然。' },
  { label: '真人口播', icon: <SmileOutlined />, color: '#3B82F6', prompt: '真人口播风格：主播正对镜头，背景虚化，自然亲切地介绍产品卖点，节奏贴近日常对话。' },
];

const AI_TOOLS = [
  { key: 'optimize', label: 'AI 优化', icon: <BulbOutlined /> },
  { key: 'script', label: '自动脚本', icon: <EditOutlined /> },
  { key: 'shot', label: '推荐镜头', icon: <EyeOutlined /> },
  { key: 'translate', label: '翻译 Prompt', icon: <GlobalOutlined /> },
  { key: 'expand', label: '扩写', icon: <ExpandOutlined /> },
];

const PLACEHOLDER = `描述越详细，视频越精准。建议包含以下要素：

主体：产品名称、外观、型号
场景：使用环境、背景色调
镜头：推近 / 环绕 / 俯拍 / 特写
风格：电影感 / 年轻活力 / 极简 / 科技感
光线：自然光 / 柔光 / 侧逆光
节奏：轻快 / 舒缓 / 快节奏
结尾：产品 Logo / Slogan / 购买引导

例如：马来西亚 TikTok 风格，展示蓝牙耳机，主角在开放式办公室佩戴，侧逆光勾勒轮廓，镜头从前推近到特写，强调降噪功能，结尾品牌 Logo 淡入。`;

/* ═════════════════════════════════════════ Main ════════════════════════════════════════════════ */
export default function AIVideoGenerator() {
  /* ── state ── */
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [productLoading, setProductLoading] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);

  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<'product' | 'free'>('product');
  const [modelOption, setModelOption] = useState('doubao-seedance-2-0-260128');
  const [resolution, setResolution] = useState('720p');
  const [aspectRatio, setAspectRatio] = useState('9:16');
  const [duration, setDuration] = useState(5);
  const [count, setCount] = useState(1);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [paramsOpen, setParamsOpen] = useState(false);

  const [productMaterial, setProductMaterial] = useState<{ url: string; name: string } | null>(null);
  const [referenceMaterial, setReferenceMaterial] = useState<{ url: string; name: string } | null>(null);
  const [logoMaterial, setLogoMaterial] = useState<{ url: string; name: string } | null>(null);

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

  /* ── init ── */
  useEffect(() => {
    api.get('/video-models/configs/available').then(r => {
      setAvailableModels(r.data?.configs || []);
      if (r.data?.configs?.[0]) setModelOption(r.data.configs[0].model_type);
    }).catch(() => {});
    loadVideos();
  }, []);

  const loadVideos = async () => {
    try { const r = await api.get('/seedance/videos', { params: { limit: 50 } }); setVideos(r.data?.videos || r.data || []); } catch {}
  };

  /* ── product ── */
  const searchProducts = async (kw: string) => {
    setProductLoading(true);
    try { const r = await api.get('/products', { params: { keyword: kw, limit: 30 } }); setProducts(r.data || []); } catch { setProducts([]); }
    finally { setProductLoading(false); }
  };
  useEffect(() => { if (productModalOpen && !products.length) searchProducts(''); }, [productModalOpen]);

  const onSelectProduct = (p: Product) => {
    setSelectedProduct(p); setProductMaterial({ url: p.image, name: p.name }); setProductModalOpen(false);
    if (!prompt) setPrompt(`专业商品展示：${p.name}，产品居中，背景柔和干净，灯光突出产品质感，节奏舒缓大气。`);
  };

  /* ── upload ── */
  const uploadImage = async (file: File): Promise<string> => {
    const fd = new FormData(); fd.append('file', file);
    const r = await api.post('/upload/image', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    return r.data?.url || r.data?.path || URL.createObjectURL(file);
  };
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, setter: (v: { url: string; name: string }) => void) => {
    const f = e.target.files?.[0]; if (!f) return;
    try { setter({ url: await uploadImage(f), name: f.name }); } catch { message.error('上传失败'); }
  };

  /* ── template ── */
  const applyTemplate = (t: typeof TEMPLATES[0]) => { setPrompt(t.prompt); setTemplateModalOpen(false); };

  /* ── AI ── */
  const aiAction = async (tool: string) => {
    if (!prompt.trim()) return message.warning('请先输入 Prompt');
    setAiLoading(true);
    try {
      const r = await api.post('/ai/optimize-prompt', { prompt, action: tool, product: selectedProduct?.name });
      if (r.data?.optimized) { setPrompt(r.data.optimized); message.success('已完成'); }
    } catch {
      const addons: Record<string, string> = {
        optimize: '。镜头推进平滑，光线柔和自然，色调温暖，电影级质感。',
        script: '\n\n【分镜1·开场】环境全景，主角入画\n【分镜2·特写】产品细节，灯光聚焦\n【分镜3·场景】使用演示，自然互动\n【分镜4·收尾】Logo淡入，行动号召',
        shot: '\n\n推荐镜头：①推近特写 ②环绕展示 ③俯拍拆箱',
        translate: '\n\n[English] Professional TikTok product showcase: centered composition, soft natural lighting, smooth camera movement, cinema-grade film quality.',
        expand: '。丰富场景细节：清晨阳光透过窗帘洒入，柔和暖色调，浅景深虚化背景，电影级画质，慢动作产品展示。',
      };
      if (addons[tool]) { setPrompt(p => p + addons[tool]); message.info('已应用建议'); }
    }
    finally { setAiLoading(false); }
  };

  /* ── generate ── */
  const handleGenerate = async () => {
    if (!prompt.trim()) return message.warning('请输入视频创意');
    if (generating) return;
    setGenerating(true); setGenError(''); setProgress(0); setPreviewVideo(null); setResultExpanded(true);
    const t0 = Date.now();
    try {
      const pTimer = setInterval(() => setProgress(v => Math.min(v + Math.random() * 8, 92)), 700);
      const r = await api.post('/seedance/generate', {
        prompt, product_id: selectedProduct?.id, product_image: productMaterial?.url, reference_image: referenceMaterial?.url,
        model: modelOption, resolution, duration, aspect_ratio: aspectRatio, count, voice_enabled: voiceEnabled,
      });
      clearInterval(pTimer); setProgress(95);
      const vid = r.data?.video_id || r.data?.id;
      if (vid) { await poll(vid); }
      else if (r.data?.video_url) {
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
    } setGenError('超时，请查看历史记录');
  };

  const handleDownload = (v: Video) => { const a = document.createElement('a'); a.href = v.video_url; a.download = v.title || 'video.mp4'; a.target = '_blank'; a.click(); };

  /* ════════════════════════════════════ Render ════════════════════════════════════════════════════ */
  return (
    <div style={{ background: C.bg, minHeight: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

      {/* ══ HEADER 64px ══ */}
      <div style={{ width: '100%', background: C.cardBg, height: 56, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <PageHeader title="AI 视频生成" icon={<VideoCameraOutlined />} style={{ marginBottom: 0 }} />
          <Segmented size="small" value={mode} onChange={(v: any) => setMode(v)}
            options={[{ label: '商品带货', value: 'product' }, { label: '自由创作', value: 'free' }]}
            style={{ marginLeft: 16 }} />
        </div>
        <Space size={16}>
          <Select size="small" value={modelOption} onChange={setModelOption} variant="borderless" style={{ minWidth: 120, fontWeight: 600 }}
            options={availableModels.length > 0 ? availableModels.map(m => ({ value: m.model_type, label: m.model_info?.name || m.model_type })) : [{ value: 'doubao-seedance-2-0-260128', label: 'Seedance V2' }, { value: 'kling-2.1', label: 'Kling 2.1' }]} />
          <Badge count={videos.length} size="small" offset={[-2, 2]}>
            <Button size="small" icon={<HistoryOutlined />} onClick={() => setHistoryOpen(true)}>历史记录</Button>
          </Badge>
        </Space>
      </div>

      {/* ══ MAIN 960px centered ══ */}
      <div style={{ width: '100%', maxWidth: C.maxW, flex: 1, display: 'flex', flexDirection: 'column', padding: '20px 0', gap: 12 }}>

        {/* ══ 上传 + 商品 + 模板 Row 48px ══ */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 4px' }}>
          {/* Product */}
          {selectedProduct ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: C.primaryLight, borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 600, color: C.primary, cursor: 'default' }}>
              <img src={selectedProduct.image} style={{ width: 20, height: 20, borderRadius: 4 }} />
              {selectedProduct.name.slice(0, 10)}
              <Button type="text" size="small" icon={<CloseOutlined style={{ fontSize: 10 }} />} onClick={() => { setSelectedProduct(null); setProductMaterial(null); setPrompt(''); }} style={{ color: C.primary, padding: 0 }} />
            </div>
          ) : (
            <Button size="small" type="text" icon={<AppstoreAddOutlined />} onClick={() => setProductModalOpen(true)} style={{ color: C.textSecondary, fontSize: 12 }}>选择商品</Button>
          )}
          <div style={{ width: 1, height: 16, background: C.border }} />
          {/* Upload Buttons */}
          {[
            { label: '商品图', material: productMaterial, setter: setProductMaterial, icon: <FileImageOutlined />, onClear: () => setProductMaterial(null) },
            { label: '参考图', material: referenceMaterial, setter: setReferenceMaterial, icon: <PictureOutlined />, onClear: () => setReferenceMaterial(null) },
            { label: 'Logo', material: logoMaterial, setter: setLogoMaterial, icon: <AppstoreOutlined />, onClear: () => setLogoMaterial(null) },
          ].map(u => (
            <UploadChip key={u.label} label={u.label} icon={u.icon} material={u.material}
              onChange={e => handleUpload(e, u.setter)} onClear={u.onClear} />
          ))}
          <div style={{ flex: 1 }} />
          <Button size="small" type="text" onClick={() => setTemplateModalOpen(true)} style={{ color: C.textTertiary, fontSize: 12 }}>✨ 模板</Button>
        </div>

        {/* ══ PROMPT 360px ══ */}
        <div style={{
          background: C.cardBg, borderRadius: 16, border: `1px solid ${C.border}`,
          boxShadow: C.shadow, display: 'flex', flexDirection: 'column',
          transition: 'border-color .2s',
          borderColor: prompt ? '#d4bfff' : C.border,
        }}>
          <div style={{ padding: '20px 24px 12px' }}>
            <Text style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary }}>💡 描述你想生成的视频</Text>
          </div>
          <TextArea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder={PLACEHOLDER}
            autoSize={{ minRows: 8, maxRows: 8 }}
            style={{ fontSize: 13, lineHeight: 1.7, resize: 'none', border: 'none', boxShadow: 'none', padding: '0 24px', flex: 1, color: C.textPrimary }}
            variant="borderless"
            maxLength={4000}
          />
          {/* AI Tools */}
          <div style={{ padding: '10px 20px', borderTop: `1px solid ${C.borderLight}`, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {AI_TOOLS.map(t => (
              <Button key={t.key} size="small" type="text" icon={t.icon}
                loading={aiLoading && t.key === 'optimize'}
                onClick={() => aiAction(t.key)}
                style={{ borderRadius: 18, fontSize: 12, color: C.textSecondary, background: '#F8FAFC', padding: '4px 14px' }}>
                {t.label}
              </Button>
            ))}
          </div>
          {/* Template Chips */}
          <div style={{ padding: '6px 20px 12px', display: 'flex', gap: 6, flexWrap: 'wrap', borderTop: `1px solid ${C.borderLight}` }}>
            <Text style={{ fontSize: 11, color: C.textTertiary, marginRight: 2, lineHeight: '24px' }}>推荐模板</Text>
            {TEMPLATES.slice(0, 5).map(t => (
              <div key={t.label} onClick={() => setPrompt(t.prompt)}
                style={{ padding: '2px 10px', borderRadius: 14, background: '#F8FAFC', cursor: 'pointer', fontSize: 11, color: C.textSecondary, fontWeight: 500, border: '1px solid transparent', transition: 'all .15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = t.color; e.currentTarget.style.color = t.color; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.color = C.textSecondary; }}>
                {t.label}
              </div>
            ))}
            <div onClick={() => setTemplateModalOpen(true)} style={{ padding: '2px 10px', borderRadius: 14, cursor: 'pointer', fontSize: 11, color: C.textTertiary }}>更多 →</div>
          </div>
        </div>

        {/* ══ Params Tags 44px ══ */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <TagChip active icon={<VideoCameraOutlined />}>{modelOption.startsWith('kling') ? 'Kling 2.1' : modelOption.startsWith('minimax') ? 'MiniMax' : 'Seedance V2'}</TagChip>
          <TagChip active>{aspectRatio}</TagChip>
          <TagChip active>{resolution}</TagChip>
          <TagChip active>{duration}秒</TagChip>
          <TagChip active>{count}条</TagChip>
          <TagChip active={voiceEnabled} onClick={() => setVoiceEnabled(!voiceEnabled)} icon={voiceEnabled ? <SoundOutlined /> : <StopOutlined />}>{voiceEnabled ? '有声' : '静音'}</TagChip>
          <Button type="link" size="small" icon={<DownOutlined rotate={paramsOpen ? 180 : 0} />} onClick={() => setParamsOpen(!paramsOpen)}
            style={{ color: C.textTertiary, fontSize: 12, padding: '0 4px' }}>更多参数</Button>
        </div>

        {/* Params Drawer */}
        <Drawer title="视频参数" placement="right" width={320} open={paramsOpen} onClose={() => setParamsOpen(false)}>
          <Space direction="vertical" size={20} style={{ width: '100%' }}>
            <div><Text style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 10 }}>模型</Text>
              <Select value={modelOption} onChange={setModelOption} style={{ width: '100%' }}
                options={availableModels.length > 0 ? availableModels.map(m => ({ value: m.model_type, label: m.model_info?.name || m.model_type })) : [{ value: 'doubao-seedance-2-0-260128', label: 'Seedance V2' }, { value: 'kling-2.1', label: 'Kling 2.1' }]} />
            </div>
            <div><Text style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 10 }}>比例</Text>
              <Segmented block value={aspectRatio} onChange={(v: any) => setAspectRatio(v)} options={[{ value: '9:16', label: '9:16 竖屏' }, { value: '16:9', label: '16:9 横屏' }, { value: '1:1', label: '1:1 方形' }]} />
            </div>
            <div><Text style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 10 }}>分辨率</Text>
              <Segmented block value={resolution} onChange={(v: any) => setResolution(v)} options={['480p', '720p', '1080p'].map(v => ({ value: v, label: v }))} />
            </div>
            <div><Text style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 10 }}>时长</Text>
              <Segmented block value={duration} onChange={(v: any) => setDuration(v)} options={[5, 10, 15].map(v => ({ value: v, label: `${v}秒` }))} />
            </div>
            <div><Text style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 10 }}>数量</Text>
              <Segmented block value={count} onChange={(v: any) => setCount(v)} options={[1, 2, 4].map(v => ({ value: v, label: `${v}条` }))} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 13, fontWeight: 600 }}>声音</Text>
              <Button size="small" type={voiceEnabled ? 'primary' : 'default'} icon={voiceEnabled ? <SoundOutlined /> : <StopOutlined />} onClick={() => setVoiceEnabled(!voiceEnabled)}>
                {voiceEnabled ? '已开启' : '已关闭'}
              </Button>
            </div>
          </Space>
        </Drawer>

        {/* ══ GENERATE 56px ══ */}
        <Button type="primary" size="large" block loading={generating} disabled={!prompt.trim()}
          onClick={handleGenerate}
          icon={generating ? <LoadingOutlined /> : <ThunderboltOutlined />}
          style={{
            height: 56, borderRadius: 14, fontSize: 16, fontWeight: 700, letterSpacing: '0.3px',
            background: prompt.trim() ? 'linear-gradient(135deg, #8b5cf6, #6E56FF)' : '#D1D5DB',
            border: 'none',
            boxShadow: prompt.trim() ? `0 6px 24px rgba(110,86,255,0.35), 0 2px 8px rgba(110,86,255,0.20)` : 'none',
          }}>
          {generating ? `正在生成 AI 视频 · ${Math.round(progress)}%` : `⚡ 立即生成视频`}
        </Button>

        {/* ══ RESULT (inline) ══ */}
        {resultExpanded && (
          <div style={{ background: previewVideo ? '#0F172A' : C.cardBg, borderRadius: 16, border: `1px solid ${previewVideo ? 'transparent' : C.border}`, overflow: 'hidden' }}>
            {generating ? (
              <div style={{ textAlign: 'center', padding: '60px 24px' }}>
                <LoadingOutlined spin style={{ fontSize: 40, color: C.primary, marginBottom: 16 }} />
                <Progress percent={Math.round(progress)} strokeColor={{ from: '#8b5cf6', to: '#6E56FF' }} style={{ maxWidth: 320, margin: '0 auto 12px' }} />
                <Text style={{ color: C.textSecondary, fontSize: 14, display: 'block', marginBottom: 4 }}>AI 正在生成视频…</Text>
                <Text style={{ color: C.textTertiary, fontSize: 12 }}>预计 40-60 秒，请耐心等待</Text>
              </div>
            ) : genError ? (
              <div style={{ textAlign: 'center', padding: '40px 24px' }}>
                <CloseCircleFilled style={{ fontSize: 36, color: C.error, marginBottom: 12 }} />
                <Text style={{ color: C.textPrimary, display: 'block', marginBottom: 12 }}>{genError}</Text>
                <Button onClick={handleGenerate} style={{ borderRadius: 8 }}>重新生成</Button>
              </div>
            ) : previewVideo ? (<>
              <div style={{ position: 'relative', minHeight: 360, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <video ref={videoRef} src={previewVideo.video_url} controls poster={previewVideo.thumbnail_url}
                  style={{ width: '100%', maxHeight: 500, objectFit: 'contain' }} />
              </div>
              <div style={{ padding: '14px 20px', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <Space size={6}>
                  <Button ghost size="small" icon={<DownloadOutlined />} onClick={() => handleDownload(previewVideo)} style={{ borderRadius: 8 }}>下载</Button>
                  <Button ghost size="small" icon={<ReloadOutlined />} onClick={handleGenerate} style={{ borderRadius: 8 }}>再生成</Button>
                  <Button ghost size="small" icon={<EditOutlined />} style={{ borderRadius: 8 }}>继续编辑</Button>
                  <Button ghost size="small" icon={<SaveOutlined />} style={{ borderRadius: 8 }}>保存素材</Button>
                </Space>
                {lastGenStats && (
                  <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
                    <span>模型: <strong style={{ color: '#fff' }}>{previewVideo.model || modelOption}</strong></span>
                    <span>时长: <strong style={{ color: '#fff' }}>{previewVideo.duration}s</strong></span>
                    <span>Token: <strong style={{ color: '#fff' }}>{previewVideo.token_usage || 0}</strong></span>
                  </div>
                )}
              </div>
            </>) : null}
          </div>
        )}
      </div>

      {/* ══ Product Modal ══ */}
      <Modal title="选择商品" open={productModalOpen} onCancel={() => setProductModalOpen(false)} footer={null} width={540}>
        <Input.Search allowClear onSearch={searchProducts} onChange={() => {}} style={{ marginBottom: 12 }} />
        <Spin spinning={productLoading}>
          <div style={{ maxHeight: 400, overflow: 'auto' }}>
            {products.length === 0 ? <Empty description="未找到产品" /> : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {products.map(p => (
                  <div key={p.id} onClick={() => onSelectProduct(p)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, borderRadius: 8, border: `1px solid ${C.border}`, cursor: 'pointer' }}>
                    <img src={p.image} style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover' }} />
                    <div style={{ flex: 1 }}><Text ellipsis style={{ fontSize: 12, fontWeight: 500, display: 'block' }}>{p.name}</Text><Text style={{ fontSize: 11, color: C.textTertiary }}>{p.sku}</Text></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Spin>
      </Modal>

      {/* ══ Template Modal ══ */}
      <Modal title="✨ 推荐模板" open={templateModalOpen} onCancel={() => setTemplateModalOpen(false)} footer={null} width={520}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {TEMPLATES.map(t => (
            <div key={t.label} onClick={() => applyTemplate(t)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 10, background: '#F8FAFC', cursor: 'pointer' }}
              onMouseEnter={e => { e.currentTarget.style.background = `${t.color}12`; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#F8FAFC'; }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: `${t.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.color, fontSize: 16 }}>{t.icon}</div>
              <div><Text style={{ fontSize: 13, fontWeight: 600 }}>{t.label}</Text><Text style={{ fontSize: 11, color: C.textTertiary, display: 'block' }}>{t.prompt.slice(0, 50)}…</Text></div>
            </div>
          ))}
        </div>
      </Modal>

      {/* ══ History Drawer ══ */}
      <Drawer title="历史记录" placement="right" width={400} open={historyOpen} onClose={() => setHistoryOpen(false)}>
        {videos.length === 0 ? <Empty description="暂无历史" /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {videos.map(v => (
              <div key={v.id} onClick={() => { setPreviewVideo(v); setResultExpanded(true); setHistoryOpen(false); }}
                style={{ display: 'flex', gap: 10, padding: 10, borderRadius: 8, border: `1px solid ${C.border}`, cursor: 'pointer' }}>
                <img src={v.thumbnail_url || v.product_image || ''} style={{ width: 64, height: 64, borderRadius: 6, objectFit: 'cover', background: C.bg }} />
                <div style={{ flex: 1 }}>
                  <Text ellipsis style={{ fontSize: 12, fontWeight: 500, display: 'block' }}>{v.title || '未命名'}</Text>
                  <Text style={{ fontSize: 11, color: C.textTertiary }}>{v.model} · {v.duration}s · {new Date(v.created_at).toLocaleString()}</Text>
                </div>
                {v.status === 'completed' ? <CheckCircleFilled style={{ color: C.success }} /> : v.status === 'failed' ? <CloseCircleFilled style={{ color: C.error }} /> : <ClockCircleOutlined style={{ color: C.warning }} />}
              </div>
            ))}
          </div>
        )}
      </Drawer>
    </div>
  );
}

/* ═════════════════════════════════════════ Sub Components ════════════════════════════════════════ */

function UploadChip({ label, icon, material, onChange, onClear }: {
  label: string; icon: React.ReactNode; material?: { url: string } | null;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; onClear: () => void;
}) {
  return (
    <div style={{ position: 'relative' }}>
      <input type="file" accept="image/*,video/*" onChange={onChange} style={{ display: 'none' }} id={`up-${label}`} />
      {material ? (
        <div style={{ position: 'relative', borderRadius: 6, overflow: 'hidden', width: 36, height: 36, border: `1px solid ${C.border}` }}>
          <img src={material.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <Button size="small" type="text" icon={<CloseOutlined style={{ fontSize: 10 }} />} onClick={e => { e.stopPropagation(); onClear(); }}
            style={{ position: 'absolute', top: 0, right: 0, padding: 0, background: 'rgba(255,255,255,0.9)', borderRadius: 0 }} />
        </div>
      ) : (
        <Tooltip title={label}>
          <label htmlFor={`up-${label}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, border: `1px dashed ${C.border}`, cursor: 'pointer', fontSize: 11, color: C.textSecondary }}>
            <PlusOutlined style={{ fontSize: 11 }} /> {icon} {label}
          </label>
        </Tooltip>
      )}
    </div>
  );
}

function TagChip({ active, onClick, icon, children }: { active?: boolean; onClick?: () => void; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6,
      background: active !== false ? '#F4F2FF' : '#F1F3F5',
      color: active !== false ? C.primary : C.textTertiary,
      fontSize: 12, fontWeight: 500, cursor: onClick ? 'pointer' : 'default',
      border: active !== false ? `1px solid ${C.primaryLight}` : `1px solid transparent`,
    }}>
      {icon}{children}
    </div>
  );
}
