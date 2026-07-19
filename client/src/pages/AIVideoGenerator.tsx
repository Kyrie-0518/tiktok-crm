import React, { useEffect, useRef, useState } from 'react';
import { Button, Input, Select, Modal, message, Tooltip, Empty, Spin, Drawer, Badge, Progress, Typography, Space, Segmented } from 'antd';
import {
  VideoCameraOutlined, PictureOutlined, ThunderboltOutlined, HistoryOutlined,
  ReloadOutlined, DownloadOutlined, CheckCircleFilled, CloseCircleFilled, ClockCircleOutlined,
  LoadingOutlined, PlayCircleOutlined, AppstoreOutlined, PlusOutlined, BulbOutlined, EditOutlined,
  CloseOutlined, FireOutlined, GiftOutlined, SmileOutlined, StarOutlined,
  AppstoreAddOutlined, SaveOutlined, GlobalOutlined, ExpandOutlined,
  SoundOutlined, StopOutlined, EyeOutlined, FileImageOutlined, SearchOutlined,
  ThunderboltFilled,
} from '@ant-design/icons';
import api from '../api';
import { PageHeader } from '../components/design-system';

const { TextArea } = Input;
const { Text } = Typography;

/* ══════════════════════════ Design Tokens ══════════════════════════ */
const T = {
  bg: '#F5F7FB', cardBg: '#FFFFFF',
  primary: '#6E56FF', primaryHover: '#7C6BFF', primaryLight: '#F4F2FF',
  border: '#EAECF0', borderLight: '#F1F3F5',
  textPrimary: '#1A1D2E', textSecondary: '#5A5F6E', textTertiary: '#9498A4',
  success: '#22C55E', warning: '#F59E0B', error: '#EF4444',
  radiusCard: 14, radiusSm: 8,
  shadow: '0 1px 8px rgba(15,23,42,0.04)',
};

/* ══════════════════════════ Types ══════════════════════════ */
interface Product { id: number; sku: string; name: string; image: string; sell_price: number; }
interface Video { id: number; title: string; video_url: string; thumbnail_url: string; prompt: string; model: string; resolution: string; duration: number; aspect_ratio: string; status: string; product_name?: string; product_image?: string; created_at: string; token_usage?: number; time_cost?: number; }

/* ══════════════════════════ Templates (compact) ══════════════════════════ */
interface Template { label: string; icon: React.ReactNode; color: string; prompt: string; tags: string[]; }

const TEMPLATES: Template[] = [
  { label: '商品介绍', icon: <GiftOutlined />, color: '#6E56FF', tags: ['3C','服饰'], prompt: '专业商品展示镜头：产品居中，背景纯净柔和，灯光突出产品质感，慢速 360° 旋转展示。' },
  { label: 'TikTok爆款', icon: <ThunderboltOutlined />, color: '#EF4444', tags: ['短视频','爆款'], prompt: 'TikTok 潮流风：快速剪辑、动感音乐、字幕弹跳、前3秒抓眼球、适合年轻用户群。' },
  { label: '真人带货', icon: <SmileOutlined />, color: '#3B82F6', tags: ['口播','转化'], prompt: '真人口播：主播正对镜头，背景虚化自然，亲切介绍产品卖点，节奏贴近日常对话。' },
  { label: '种草测评', icon: <StarOutlined />, color: '#8B5CF6', tags: ['对比','体验'], prompt: '测评风格：手持产品近景演示，场景化使用画面，强调使用前后对比和体验感。' },
  { label: '品牌故事', icon: <StarOutlined />, color: '#F59E0B', tags: ['高端','品牌'], prompt: '电影级品牌片：航拍城市→工匠细节→用户场景→Logo收尾，大气舒缓。' },
  { label: '开箱测评', icon: <AppstoreOutlined />, color: '#22C55E', tags: ['惊喜','细节'], prompt: '开箱风格：俯拍桌面，双手优雅拆包装，渐次展示细节，自然惊喜反应。' },
  { label: '节日营销', icon: <FireOutlined />, color: '#EF4444', tags: ['节日','促销'], prompt: '节日促销：红金配色交错，礼盒特效，烟花背景，文字动画浮现，节奏明快。' },
  { label: '3C数码', icon: <EyeOutlined />, color: '#3B82F6', tags: ['科技','炫光'], prompt: '科技产品风格：深色背景、电子元件细节、多角度展示、未来感光线。' },
  { label: '美食', icon: <FireOutlined />, color: '#F97316', tags: ['食物','慢动作'], prompt: '美食镜头：慢动作倒酱汁、水汽升腾、餐具特写、饱和度高让人有食欲。' },
  { label: 'Shopee', icon: <PlayCircleOutlined />, color: '#F97316', tags: ['东南亚'], prompt: 'Shopee展示：横向平铺产品，关键参数浮现，暖色调背景。' },
];

const AI_INLINE_SUGGESTIONS = [
  { label: '+镜头', icon: <VideoCameraOutlined />, text: '\n镜头：推近特写 → 环绕展示 → Logo淡入。' },
  { label: '+动作', icon: <PlayCircleOutlined />, text: '\n动作：模特自然展示，手指轻触屏幕突出交互。' },
  { label: '+Logo', icon: <AppstoreOutlined />, text: '\n结尾：品牌Logo中心放大淡出，Slogan浮现。' },
  { label: '+CTA', icon: <ThunderboltOutlined />, text: '\n结尾：行动号召"立即购买"，动态弹跳效果。' },
];

const AI_TOOLS = [
  { key: 'optimize', label: 'AI 优化', icon: <BulbOutlined /> },
  { key: 'script', label: '脚本生成', icon: <EditOutlined /> },
  { key: 'translate', label: '英文 Prompt', icon: <GlobalOutlined /> },
  { key: 'expand', label: '继续扩写', icon: <ExpandOutlined /> },
  { key: 'shot', label: '镜头建议', icon: <EyeOutlined /> },
];

/* ══════════════════════════ Prompt Score ══════════════════════════ */
function promptScore(p: string) {
  if (!p?.trim()) return { score: 0, label: '—', color: T.textTertiary };
  let s = 30 + Math.min(p.trim().length * 0.15, 20);
  if (p.includes('镜头') || p.includes('场景') || p.includes('光线')) s += 15;
  if (p.includes('风格') || p.includes('节奏')) s += 10;
  if (p.includes('产品') || p.includes('Logo') || p.includes('结尾')) s += 10;
  s = Math.min(s, 100);
  if (s >= 85) return { score: s, label: '优秀', color: T.success };
  if (s >= 60) return { score: s, label: '良好', color: T.warning };
  return { score: s, label: '待完善', color: T.textTertiary };
}

/* ══════════════════════════ Main ══════════════════════════ */
export default function AIVideoGenerator() {
  /* ── State ── */
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [productLoading, setProductLoading] = useState(false);
  const [templateMarketOpen, setTemplateMarketOpen] = useState(false);
  const [templateSearch, setTemplateSearch] = useState('');

  const [prompt, setPrompt] = useState('');
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

  const [availableModels, setAvailableModels] = useState<any[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [recentWorks, setRecentWorks] = useState<Video[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const q = promptScore(prompt);

  /* ── Init ── */
  useEffect(() => {
    api.get('/video-models/configs/available').then(r => {
      setAvailableModels(r.data?.configs || []);
      if (r.data?.configs?.[0]) setModelOption(r.data.configs[0].model_type);
    }).catch(() => {});
    loadVideos();
  }, []);

  const loadVideos = async () => {
    try { const r = await api.get('/seedance/videos', { params: { limit: 12 } }); const list = r.data?.videos || r.data || []; setVideos(list); setRecentWorks(list.filter((v: Video) => v.status === 'completed').slice(0, 6)); } catch {}
  };

  /* ── Product ── */
  const searchProducts = async (kw: string) => { setProductLoading(true); try { const r = await api.get('/products', { params: { keyword: kw, limit: 30 } }); setProducts(r.data || []); } catch { setProducts([]); } finally { setProductLoading(false); } };
  useEffect(() => { if (productModalOpen && !products.length) searchProducts(''); }, [productModalOpen]);

  const onSelectProduct = (p: Product) => {
    setSelectedProduct(p); setProductMaterial({ url: p.image, name: p.name }); setProductModalOpen(false);
    if (!prompt) setPrompt(`专业商品展示：${p.name}，产品居中，背景柔和干净，灯光突出产品质感，节奏舒缓大气。`);
  };

  /* ── Upload ── */
  const uploadImage = async (file: File): Promise<string> => { const fd = new FormData(); fd.append('file', file); const r = await api.post('/upload/image', fd, { headers: { 'Content-Type': 'multipart/form-data' } }); return r.data?.url || r.data?.path || URL.createObjectURL(file); };
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, setter: (v: { url: string; name: string }) => void) => { const f = e.target.files?.[0]; if (!f) return; try { setter({ url: await uploadImage(f), name: f.name }); } catch { message.error('上传失败'); } };

  /* ── Template ── */
  const applyTemplate = (t: Template) => { setPrompt(t.prompt); setTemplateMarketOpen(false); message.success({ content: `✓ 已应用「${t.label}」模板`, duration: 2 }); };

  /* ── AI ── */
  const aiAction = async (tool: string) => {
    if (!prompt.trim()) return message.warning('请先输入 Prompt'); setAiLoading(true);
    try { const r = await api.post('/ai/optimize-prompt', { prompt, action: tool, product: selectedProduct?.name }); if (r.data?.optimized) { setPrompt(r.data.optimized); message.success('已完成'); } }
    catch { const a: Record<string, string> = { optimize: '。镜头推进平滑，光线柔和自然，色调温暖，电影级质感。', script: '\n\n【分镜1】环境全景→主角入画\n【分镜2】产品特写→灯光聚焦\n【分镜3】使用演示→自然互动\n【分镜4】Logo淡入→行动号召', shot: '\n\n推荐镜头：①推近特写 ②环绕展示 ③俯拍拆箱', translate: '\n\n[English] Professional TikTok product showcase: centered composition, soft lighting.', expand: '。丰富细节：清晨阳光透过窗帘洒入，浅景深虚化背景，电影级画质。' }; if (a[tool]) { setPrompt(p => p + a[tool]); message.info('已应用'); } }
    finally { setAiLoading(false); }
  };
  const addInline = (t: string) => setPrompt(p => p + t);

  /* ── Generate ── */
  const handleGenerate = async () => {
    if (!prompt.trim()) return message.warning('请输入视频创意'); if (generating) return;
    setGenerating(true); setGenError(''); setProgress(0); setPreviewVideo(null);
    try {
      const pTimer = setInterval(() => setProgress(v => Math.min(v + Math.random() * 8, 92)), 700);
      const r = await api.post('/seedance/generate', { prompt, product_id: selectedProduct?.id, product_image: productMaterial?.url, reference_image: referenceMaterial?.url, model: modelOption, resolution, duration, aspect_ratio: aspectRatio, count, voice_enabled: voiceEnabled });
      clearInterval(pTimer); setProgress(95);
      const vid = r.data?.video_id || r.data?.id;
      if (vid) { await poll(vid); } else if (r.data?.video_url) { setPreviewVideo({ id: r.data.id || Date.now(), title: selectedProduct?.name || 'AI 视频', video_url: r.data.video_url, thumbnail_url: r.data.thumbnail_url || '', prompt, model: modelOption, resolution, duration, aspect_ratio: aspectRatio, status: 'completed', created_at: new Date().toISOString(), token_usage: r.data.token_usage, product_name: selectedProduct?.name }); setProgress(100); loadVideos(); }
    } catch (e: any) { setGenError(e.response?.data?.error || e.message || '生成失败'); } finally { setGenerating(false); }
  };
  const poll = async (vid: number) => { for (let i = 0; i < 60; i++) { try { const r = await api.get(`/seedance/videos/${vid}`); const v = r.data?.video || r.data; if (v.status === 'completed' || v.video_url) { setPreviewVideo(v); setProgress(100); loadVideos(); return; } if (v.status === 'failed') { setGenError(v.error || '生成失败'); return; } if (v.progress) setProgress(v.progress); } catch {} await new Promise(r => setTimeout(r, 5000)); } setGenError('超时，请查看历史记录'); };
  const handleDownload = (v: Video) => { const a = document.createElement('a'); a.href = v.video_url; a.download = v.title || 'video.mp4'; a.target = '_blank'; a.click(); };

  /* ══════════════════════════ Render ══════════════════════════ */
  return (
    <div style={{ background: T.bg, minHeight: 'calc(100vh - 64px)' }}>

      {/* ── Header ── */}
      <div style={{ height: 52, background: T.cardBg, borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px' }}>
        <PageHeader title="AI 视频工作台" icon={<VideoCameraOutlined />} style={{ marginBottom: 0 }} />
        <Space size={12}>
          {selectedProduct && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: T.primaryLight, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600, color: T.primary }}>
              <img src={selectedProduct.image} style={{ width: 16, height: 16, borderRadius: 3 }} />
              {selectedProduct.name.slice(0, 10)}
            </div>
          )}
          <Select size="small" value={modelOption} onChange={setModelOption} variant="borderless" style={{ minWidth: 110, fontWeight: 600 }} options={availableModels.length > 0 ? availableModels.map(m => ({ value: m.model_type, label: m.model_info?.name || m.model_type })) : [{ value: 'doubao-seedance-2-0-260128', label: 'Seedance V2' }, { value: 'kling-2.1', label: 'Kling 2.1' }]} />
          <Badge count={videos.length} size="small"><Button size="small" icon={<HistoryOutlined />} onClick={() => setHistoryOpen(true)}>历史</Button></Badge>
        </Space>
      </div>

      {/* ── Main: 3 columns layout ── */}
      <div style={{ maxWidth: 1480, margin: '16px auto', display: 'flex', gap: 12, padding: '0 20px', alignItems: 'flex-start' }}>

        {/* ═══════ LEFT: Prompt Studio (compact card) ═══════ */}
        <div style={{
          width: 220, flexShrink: 0,
          background: T.cardBg, borderRadius: T.radiusCard, border: `1px solid ${T.border}`,
          boxShadow: T.shadow, padding: 14,
          alignSelf: 'flex-start', position: 'sticky', top: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <Text style={{ fontSize: 12, fontWeight: 700, color: T.textPrimary }}>✨ Prompt 模板</Text>
            <Button size="small" type="text" onClick={() => setTemplateMarketOpen(true)} style={{ fontSize: 10, color: T.primary, padding: '0 4px', fontWeight: 500 }}>全部 →</Button>
          </div>
          <Input size="small" prefix={<SearchOutlined style={{ color: T.textTertiary }} />} placeholder="搜索模板…" variant="borderless"
            style={{ background: T.bg, borderRadius: 6, fontSize: 11, marginBottom: 10 }} onChange={e => setTemplateSearch(e.target.value)} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {TEMPLATES.filter(t => !templateSearch || t.label.includes(templateSearch) || t.tags.some(tg => tg.includes(templateSearch))).map(t => (
              <div key={t.label} onClick={() => applyTemplate(t)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6,
                  cursor: 'pointer', border: '1px solid transparent', transition: 'all .15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = `${t.color}08`; e.currentTarget.style.borderColor = `${t.color}30`; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}>
                <div style={{ width: 24, height: 24, borderRadius: 5, background: `${t.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.color, fontSize: 12, flexShrink: 0 }}>{t.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: T.textPrimary, lineHeight: 1.3 }}>{t.label}</div>
                  <div style={{ display: 'flex', gap: 2, marginTop: 2 }}>
                    {t.tags.slice(0, 2).map(tg => <span key={tg} style={{ fontSize: 8, color: T.textTertiary, background: T.bg, padding: '0 3px', borderRadius: 2 }}>{tg}</span>)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ═══════ MIDDLE: V5 原始内容（任务+素材+Prompt+参数+生成） ═══════ */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>

          {/* Row1: Task + Materials */}
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1, background: T.cardBg, borderRadius: T.radiusCard, border: `1px solid ${T.border}`, boxShadow: T.shadow, padding: '12px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ fontSize: 11, fontWeight: 600, color: T.textSecondary }}>📋 当前任务</Text>
                <Button size="small" type="text" icon={<AppstoreAddOutlined />} onClick={() => setProductModalOpen(true)} style={{ color: T.textSecondary, fontSize: 10 }}>选商品</Button>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary }}>{selectedProduct?.name || '未选择商品'}</div>
              <div style={{ fontSize: 10, color: T.textTertiary, marginTop: 2 }}>{modelOption.startsWith('kling') ? 'Kling 2.1' : modelOption.startsWith('minimax') ? 'MiniMax' : 'Seedance V2'} · {aspectRatio} · {duration}秒</div>
            </div>
            <div style={{ flex: 2, background: T.cardBg, borderRadius: T.radiusCard, border: `1px solid ${T.border}`, boxShadow: T.shadow, padding: '12px 16px' }}>
              <Text style={{ fontSize: 11, fontWeight: 600, color: T.textSecondary, display: 'block', marginBottom: 8 }}>📦 素材</Text>
              <div style={{ display: 'flex', gap: 10 }}>
                {[{ k: 'p', label: '商品图', material: productMaterial, setter: setProductMaterial, icon: <FileImageOutlined />, onClear: () => setProductMaterial(null) },
                  { k: 'r', label: '参考图', material: referenceMaterial, setter: setReferenceMaterial, icon: <PictureOutlined />, onClear: () => setReferenceMaterial(null) },
                  { k: 'l', label: 'Logo', material: logoMaterial, setter: setLogoMaterial, icon: <AppstoreOutlined />, onClear: () => setLogoMaterial(null) }]
                  .map(u => <MatSlot key={u.k} {...u} onChange={e => handleUpload(e, u.setter)} />)}
              </div>
            </div>
          </div>

          {/* Row2: PROMPT */}
          <div style={{ background: T.cardBg, borderRadius: T.radiusCard, border: `1px solid ${prompt ? '#d4bfff' : T.border}`, boxShadow: T.shadow, display: 'flex', flexDirection: 'column', transition: 'border .2s' }}>
            <div style={{ padding: '14px 18px 6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 12, fontWeight: 600, color: T.textPrimary }}>💡 Prompt 创意</Text>
              <Space size={4}>
                <Text style={{ fontSize: 10, color: q.color }}>{q.label}</Text>
                <div style={{ width: 36, height: 3, borderRadius: 2, background: '#F1F3F5', overflow: 'hidden' }}><div style={{ width: `${q.score}%`, height: '100%', borderRadius: 2, background: q.color, transition: 'width .3s' }} /></div>
              </Space>
            </div>
            <TextArea
              value={prompt} onChange={e => setPrompt(e.target.value)}
              placeholder={`描述越详细，视频越精准。\n\n例如：马来西亚 TikTok 商品带货视频。\n主体：AirPods Pro — 哑光黑充电仓特写\n场景：开放式办公室，间接光环境\n镜头：推近特写 → 环绕展示降噪麦克风 → 佩戴使用\n风格：年轻科技感，轻快剪辑\n光线：侧逆光 + 柔光散射\n结尾：品牌 Logo 淡入 + 行动号召`}
              autoSize={{ minRows: 6, maxRows: 6 }}
              style={{ fontSize: 13, lineHeight: 1.7, resize: 'none', border: 'none', boxShadow: 'none', padding: '0 18px', flex: 1, fontFamily: '-apple-system, "Inter", sans-serif', color: T.textPrimary }}
              variant="borderless" maxLength={4000} />
            <div style={{ padding: '4px 18px', borderTop: `1px solid ${T.borderLight}`, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {AI_INLINE_SUGGESTIONS.map(a => (
                <Button key={a.label} size="small" type="text" icon={a.icon} onClick={() => addInline(a.text)}
                  style={{ borderRadius: 14, fontSize: 10, color: T.primary, background: T.primaryLight, padding: '1px 10px', border: 'none', fontWeight: 500 }}>{a.label}</Button>
              ))}
            </div>
            <div style={{ padding: '6px 18px 0', borderTop: `1px solid ${T.borderLight}`, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {AI_TOOLS.map(t => <Button key={t.key} size="small" type="text" icon={t.icon} loading={aiLoading && t.key === 'optimize'} onClick={() => aiAction(t.key)} style={{ borderRadius: 14, fontSize: 10, color: T.textSecondary, padding: '2px 10px', background: '#F8FAFC' }}>{t.label}</Button>)}
            </div>
            <div style={{ padding: '6px 18px 12px', display: 'flex', gap: 14, borderTop: `1px solid ${T.borderLight}`, fontSize: 10, color: T.textTertiary }}>
              <span>📊 质量 <strong style={{ color: q.color }}>{q.score}</strong></span>
              <span>🔤 {prompt.length}字</span>
              <span>⚡ ~{prompt ? Math.ceil(prompt.length * 0.15) : 0}T</span>
              <span>⏱ ~{prompt ? Math.ceil(prompt.length * 0.06 + 20) : 0}s</span>
            </div>
          </div>

          {/* Row3: Params Chips + Generate */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Chip icon={<VideoCameraOutlined />}>{modelOption.startsWith('kling') ? 'Kling 2.1' : modelOption.startsWith('minimax') ? 'MiniMax' : 'Seedance V2'}</Chip>
            <Chip>{aspectRatio}</Chip><Chip>{resolution}</Chip><Chip>{duration}秒</Chip><Chip>{count}条</Chip>
            <Chip active={voiceEnabled} onClick={() => setVoiceEnabled(!voiceEnabled)}>{voiceEnabled ? '🔊' : '🔇'}</Chip>
            <Button type="link" size="small" onClick={() => setParamsOpen(true)} style={{ color: T.textTertiary, fontSize: 10, padding: '0 2px' }}>高级 ⚙</Button>
            <div style={{ flex: 1 }} />
            <Button type="primary" size="large" loading={generating} disabled={!prompt.trim()} onClick={handleGenerate}
              icon={generating ? <LoadingOutlined /> : <ThunderboltFilled />}
              style={{ height: 46, borderRadius: 12, fontSize: 15, fontWeight: 700, padding: '0 36px', background: prompt.trim() ? 'linear-gradient(135deg, #8b5cf6, #6E56FF)' : '#E1E4EA', border: 'none', boxShadow: prompt.trim() ? '0 4px 16px rgba(110,86,255,0.28)' : 'none' }}>
              {generating ? `生成中 ${Math.round(progress)}%` : '⚡ 立即生成'}
            </Button>
          </div>
        </div>

        {/* ═══════ RIGHT: Preview (V5 unchanged) ═══════ */}
        <div style={{ width: 360, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ background: T.cardBg, borderRadius: T.radiusCard, border: `1px solid ${T.border}`, boxShadow: T.shadow, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {generating ? (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <LoadingOutlined spin style={{ fontSize: 32, color: T.primary, marginBottom: 12 }} />
                <Progress percent={Math.round(progress)} strokeColor={{ from: '#8b5cf6', to: '#6E56FF' }} style={{ maxWidth: 220, marginBottom: 8 }} />
                <Text style={{ fontSize: 13, color: T.textPrimary, fontWeight: 600, display: 'block' }}>正在生成…</Text>
                <Text style={{ fontSize: 11, color: T.textTertiary }}>预计 40-60 秒</Text>
              </div>
            ) : genError ? (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <CloseCircleFilled style={{ fontSize: 32, color: T.error, marginBottom: 8 }} />
                <Text style={{ color: T.textPrimary, marginBottom: 8, display: 'block' }}>{genError}</Text>
                <Button size="small" onClick={handleGenerate} style={{ borderRadius: 8 }}>重试</Button>
              </div>
            ) : previewVideo ? (
              <div>
                <video ref={videoRef} src={previewVideo.video_url} controls poster={previewVideo.thumbnail_url} style={{ width: '100%', background: '#0F172A', display: 'block' }} />
                <div style={{ padding: 8, display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <Button size="small" icon={<DownloadOutlined />} onClick={() => handleDownload(previewVideo)} style={{ borderRadius: 6, fontSize: 11 }}>下载</Button>
                  <Button size="small" icon={<ReloadOutlined />} onClick={handleGenerate} style={{ borderRadius: 6, fontSize: 11 }}>重生成</Button>
                  <Button size="small" icon={<SaveOutlined />} style={{ borderRadius: 6, fontSize: 11 }}>保存</Button>
                </div>
              </div>
            ) : (
              <div style={{ padding: '60px 20px', textAlign: 'center', color: T.textTertiary }}>
                <div style={{ fontSize: 40, marginBottom: 8, opacity: 0.25 }}>🎬</div>
                <Text style={{ fontSize: 12, color: T.textTertiary }}>AI 视频将在这里生成</Text>
              </div>
            )}
          </div>
          {recentWorks.length > 0 && (
            <div style={{ background: T.cardBg, borderRadius: T.radiusCard, border: `1px solid ${T.border}`, boxShadow: T.shadow, padding: '10px 14px' }}>
              <Text style={{ fontSize: 11, fontWeight: 600, color: T.textSecondary, display: 'block', marginBottom: 8 }}>📹 最近作品</Text>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {recentWorks.slice(0, 6).map(w => (
                  <div key={w.id} onClick={() => setPreviewVideo(w)}
                    style={{ borderRadius: 6, overflow: 'hidden', cursor: 'pointer', border: `1px solid ${T.borderLight}`, transition: 'all .15s', aspectRatio: '9/16' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = T.primary; }}>
                    <img src={w.thumbnail_url || w.product_image || ''} style={{ width: '100%', height: '100%', objectFit: 'cover', background: '#F1F3F5' }} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══════ Modals & Drawers ═══════ */}

      {/* Product Modal */}
      <Modal title="选择商品" open={productModalOpen} onCancel={() => setProductModalOpen(false)} footer={null} width={540}>
        <Input.Search allowClear onSearch={searchProducts} onChange={() => {}} style={{ marginBottom: 12 }} />
        <Spin spinning={productLoading}>
          <div style={{ maxHeight: 400, overflow: 'auto' }}>
            {products.length === 0 ? <Empty description="未找到产品" /> : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {products.map(p => (
                  <div key={p.id} onClick={() => onSelectProduct(p)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, borderRadius: 8, border: `1px solid ${T.border}`, cursor: 'pointer' }}>
                    <img src={p.image} style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover' }} />
                    <div><Text ellipsis style={{ fontSize: 12, fontWeight: 500, display: 'block' }}>{p.name}</Text><Text style={{ fontSize: 11, color: T.textTertiary }}>{p.sku}</Text></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Spin>
      </Modal>

      {/* Template Market Modal */}
      <Modal title="✨ Prompt 模板中心" open={templateMarketOpen} onCancel={() => setTemplateMarketOpen(false)} footer={null} width={720} style={{ top: 20 }}>
        <Input prefix={<SearchOutlined style={{ color: T.textTertiary }} />} placeholder="搜索模板…" allowClear value={templateSearch}
          onChange={e => setTemplateSearch(e.target.value)} style={{ marginBottom: 16, borderRadius: 8 }} />
        <div style={{ maxHeight: 500, overflow: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            {TEMPLATES.filter(t => !templateSearch || t.label.includes(templateSearch) || t.tags.some(tg => tg.includes(templateSearch))).map(t => (
              <div key={t.label} onClick={() => applyTemplate(t)}
                style={{ padding: '14px 16px', borderRadius: 10, border: `1px solid ${T.border}`, cursor: 'pointer', transition: 'all .15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = t.color; e.currentTarget.style.boxShadow = `0 0 0 2px ${t.color}20`; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = 'none'; }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: `${t.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.color, fontSize: 16 }}>{t.icon}</div>
                  <Text style={{ fontSize: 13, fontWeight: 600 }}>{t.label}</Text>
                </div>
                <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>{t.tags.map(tg => <span key={tg} style={{ fontSize: 9, color: T.textTertiary, background: T.bg, padding: '1px 5px', borderRadius: 3 }}>{tg}</span>)}</div>
                <Text style={{ fontSize: 11, color: T.textTertiary, display: 'block', maxHeight: 28, overflow: 'hidden', lineHeight: 1.4 }}>{t.prompt.slice(0, 60)}…</Text>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {/* Params Drawer */}
      <Drawer title="视频参数" placement="right" width={320} open={paramsOpen} onClose={() => setParamsOpen(false)}>
        <Space direction="vertical" size={22} style={{ width: '100%' }}>
          <div><Text style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 8 }}>模型</Text><Select value={modelOption} onChange={setModelOption} style={{ width: '100%' }} options={availableModels.length > 0 ? availableModels.map(m => ({ value: m.model_type, label: m.model_info?.name || m.model_type })) : [{ value: 'doubao-seedance-2-0-260128', label: 'Seedance V2' }]} /></div>
          <div><Text style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 8 }}>比例</Text><Segmented block value={aspectRatio} onChange={(v: any) => setAspectRatio(v)} options={[{ value: '9:16', label: '9:16' }, { value: '16:9', label: '16:9' }, { value: '1:1', label: '1:1' }]} /></div>
          <div><Text style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 8 }}>分辨率</Text><Segmented block value={resolution} onChange={(v: any) => setResolution(v)} options={['480p', '720p', '1080p'].map(v => ({ value: v, label: v }))} /></div>
          <div><Text style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 8 }}>时长</Text><Segmented block value={duration} onChange={(v: any) => setDuration(v)} options={[5, 10, 15].map(v => ({ value: v, label: `${v}秒` }))} /></div>
          <div><Text style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 8 }}>数量</Text><Segmented block value={count} onChange={(v: any) => setCount(v)} options={[1, 2, 4].map(v => ({ value: v, label: `${v}条` }))} /></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><Text style={{ fontSize: 12, fontWeight: 600 }}>声音</Text><Button size="small" type={voiceEnabled ? 'primary' : 'default'} onClick={() => setVoiceEnabled(!voiceEnabled)}>{voiceEnabled ? '开启' : '关闭'}</Button></div>
        </Space>
      </Drawer>

      {/* History Drawer */}
      <Drawer title="历史记录" placement="right" width={400} open={historyOpen} onClose={() => setHistoryOpen(false)}>
        {videos.length === 0 ? <Empty description="暂无历史" /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {videos.map(v => (
              <div key={v.id} onClick={() => { setPreviewVideo(v); setHistoryOpen(false); }} style={{ display: 'flex', gap: 10, padding: 10, borderRadius: 8, border: `1px solid ${T.border}`, cursor: 'pointer' }}>
                <img src={v.thumbnail_url || v.product_image || ''} style={{ width: 64, height: 64, borderRadius: 6, objectFit: 'cover', background: T.bg }} />
                <div><Text ellipsis style={{ fontSize: 12, fontWeight: 500, display: 'block' }}>{v.title || '未命名'}</Text><Text style={{ fontSize: 11, color: T.textTertiary }}>{v.model} · {v.duration}s · {new Date(v.created_at).toLocaleString()}</Text></div>
                {v.status === 'completed' ? <CheckCircleFilled style={{ color: T.success }} /> : <CloseCircleFilled style={{ color: T.error }} />}
              </div>
            ))}
          </div>
        )}
      </Drawer>
    </div>
  );
}

/* ══════════════════════════ Sub Components ══════════════════════════ */

function MatSlot({ label, icon, material, onChange, onClear }: { label: string; icon: React.ReactNode; material?: { url: string } | null; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; onClear: () => void }) {
  return (
    <div style={{ flex: 1, position: 'relative' }}>
      <input type="file" accept="image/*,video/*" onChange={onChange} style={{ display: 'none' }} id={`ms-${label}`} />
      {material ? (
        <div style={{ borderRadius: 6, overflow: 'hidden', border: `1px solid ${T.border}`, aspectRatio: '1' }}>
          <img src={material.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: 9, padding: '1px 4px', textAlign: 'center' }}>{label}</div>
          <Button size="small" type="text" icon={<CloseOutlined style={{ fontSize: 9 }} />} onClick={e => { e.stopPropagation(); onClear(); }} style={{ position: 'absolute', top: 1, right: 1, padding: 0, background: 'rgba(255,255,255,0.9)', minWidth: 16 }} />
        </div>
      ) : (
        <label htmlFor={`ms-${label}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, height: 56, borderRadius: 6, border: `1px dashed ${T.border}`, cursor: 'pointer', fontSize: 10, color: T.textTertiary }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = T.primary; e.currentTarget.style.color = T.primary; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textTertiary; }}>
          {icon}<span>{label}</span>
        </label>
      )}
    </div>
  );
}

function Chip({ active, icon, children, onClick }: { active?: boolean; icon?: React.ReactNode; children: React.ReactNode; onClick?: () => void }) {
  return <div onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '3px 8px', borderRadius: 5, background: active !== false ? T.primaryLight : '#F1F3F5', color: active !== false ? T.primary : T.textTertiary, fontSize: 10, fontWeight: 500, cursor: onClick ? 'pointer' : 'default', border: active !== false ? `1px solid ${T.primaryLight}` : '1px solid transparent' }}>{icon}{children}</div>;
}
