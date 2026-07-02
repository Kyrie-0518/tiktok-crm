import { useEffect, useRef, useState } from 'react';
import {
  Button, Select, Input, Space, Tag, Modal, Typography, message,
  Row, Col, Card, Empty, Spin, Upload, Slider, Collapse, Badge
} from 'antd';
import {
  VideoCameraOutlined,
  ReloadOutlined, EditOutlined,
  LockOutlined,
  SoundOutlined,
  CloseOutlined,
  ExpandOutlined, AudioOutlined,
  ThunderboltOutlined,
  ApiOutlined,
  AppstoreOutlined,
  PlusOutlined,
  PlayCircleOutlined,
  DownloadOutlined,
  SaveOutlined,
  HistoryOutlined,
  CheckCircleOutlined,
  LoadingOutlined,
  DeleteOutlined,
  BugOutlined,
} from '@ant-design/icons';
import api from '../api';
import { useAuthStore, useIsDeveloper, useIsManager } from '../stores/authStore';

const { TextArea } = Input;
const { Text, Title } = Typography;
const { Panel } = Collapse;

// ========== UI 配色方案（统一 #2563eb + 紫色点缀）==========
const theme = {
  primary: '#2563eb',
  primaryHover: '#1d4ed8',
  primaryLight: '#eff6ff',
  bg: '#f5f3f0',
  surface: '#ffffff',
  surfaceHover: '#f5f5f5',
  border: '#e8e5e0',
  borderLight: '#e8e5e0',
  text: '#1a1a1a',
  textSecondary: '#666',
  textTertiary: '#999',
  success: '#059669',
  successLight: '#ecfdf5',
  warning: '#f59e0b',
  warningLight: '#fffbeb',
  error: '#ef4444',
  black: '#0f172a',
  white: '#ffffff',
  // AI 紫色点缀（生成按钮、loading 等）
  aiAccent: '#7B61FF',
};

// 数字格式化：B(十亿) / M(百万) / K(千)
function formatTokenNum(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

interface Product {
  id: number;
  sku: string;
  name: string;
  image: string;
  sell_price: number;
  weight: number;
  category?: string;
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
  username?: string;
}

interface GenConfig {
  model: string;
  resolution: string;
  duration: number;
  aspectRatio: string;
  count: number;
  voiceEnabled: boolean;
}

// AI 解析结果结构
interface AIAnalysisResult {
  marketInfo: string;
  competitorData: string;
  trendingTypes: string;
  shootingSpecs: string;
  scripts: string[];
  finalPrompt: string;
}

// 1688 策划相关类型
interface Plan1688Form {
  product_name: string;
  product_url: string;
  category: string;
  price: string;
  core_selling_points: string;
  target_audience: string;
  special_requirements: string;
}

interface DouyinMaterial {
  id: string;
  title: string;
  description: string;
  cover_url: string;
  video_url: string | null;
  author: { name: string; avatar: string; followers: number };
  stats: { views: number; likes: number; comments: number; shares: number };
  tags: string[];
  duration: number;
  created_at: string;
}

// 格式化时间为本地显示
const formatLocalTime = (isoString: string | undefined) => {
  if (!isoString) return '';
  // SQLite CURRENT_TIMESTAMP 存的是 UTC 时间，JS 默认按本地时区解析
  // 补 'Z' 强制按 UTC 解析后再 toLocaleString 转本地时区
  const d = new Date(isoString + 'Z');
  if (isNaN(d.getTime())) return isoString;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  // 1小时内显示相对时间
  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin}分钟前`;
  // 24小时内显示小时
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)}小时前`;
  // 其他显示完整本地时间
  return d.toLocaleString('zh-CN', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
    hour12: false,
  });
};

export default function SeedanceVideoGenerator() {
  const username = useAuthStore(s => s.username);
  const isDeveloper = useIsDeveloper();
  const isManager = useIsManager();
  const canUseAI = isDeveloper || isManager;

  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');
  const [permissionError, setPermissionError] = useState('');
  const [currentApiInfo, setCurrentApiInfo] = useState<{ api_name?: string; api_id?: number } | null>(null);
  const [availableModels, setAvailableModels] = useState<any[]>([]);
  const [selectedModelType, setSelectedModelType] = useState<string>('seedance');

  // 创作分类
  const [activeTab, setActiveTab] = useState('product');
  const tabOptions = [
    { value: 'product', label: '商品带货视频' },
    { value: 'free', label: '自由文生视频' },
    { value: 'image', label: '图生短视频' },
  ];

  // 配置状态
  const [config, setConfig] = useState<GenConfig>({
    model: 'doubao-seedance-2-0-260128',
    resolution: '720p',
    duration: 5,
    aspectRatio: '9:16',
    count: 1,
    voiceEnabled: true,
  });

  // 产品相关
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [productLoading, setProductLoading] = useState(false);

  // 提示词
  const [prompt, setPrompt] = useState('');
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);

  // 素材上传
  const [productMaterial, setProductMaterial] = useState<{ url: string; name: string; type: 'image' | 'video' } | null>(null);
  const [referenceMaterial, setReferenceMaterial] = useState<{ url: string; name: string; type: 'image' | 'video' } | null>(null);

  // AI 解析
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<AIAnalysisResult | null>(null);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);

  // 1688 新品策划相关状态
  const [plan1688Form, setPlan1688Form] = useState<Plan1688Form>({
    product_name: '',
    product_url: '',
    category: '',
    price: '',
    core_selling_points: '',
    target_audience: '',
    special_requirements: '',
  });
  const [plan1688Analyzing, setPlan1688Analyzing] = useState(false);
  const [plan1688Result, setPlan1688Result] = useState<string | null>(null);
  const [plan1688PanelOpen, setPlan1688PanelOpen] = useState(false);

  // 抖音素材搜索相关状态
  const [douyinSearchOpen, setDouyinSearchOpen] = useState(false);
  const [douyinKeyword, setDouyinKeyword] = useState('');
  const [douyinSearching, setDouyinSearching] = useState(false);
  const [douyinMaterials, setDouyinMaterials] = useState<DouyinMaterial[]>([]);

  // 参数弹窗
  const [configModalOpen, setConfigModalOpen] = useState(false);

  // 视频列表
  const [videos, setVideos] = useState<Video[]>([]);
  const [, setGeneratingProgress] = useState(0);
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showPlayOverlay, setShowPlayOverlay] = useState(true);

  // 自定义播放器状态
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 生成统计数据
  const [lastGenStats, setLastGenStats] = useState<{ duration: number; tokens: number } | null>(() => {
    try { return JSON.parse(localStorage.getItem('seedance_last_gen_stats') || 'null'); } catch { return null; }
  });

  // 累计统计（按用户从API获取/更新）
  const [totalStats, setTotalStats] = useState<{ totalTokens: number; totalGenerations: number }>({ totalTokens: 0, totalGenerations: 0 });

  const loadTokenStats = async () => {
    try {
      const res = await api.get('/video-models/stats');
      console.log('[TokenStats] 加载成功:', res.data);
      setTotalStats(res.data);
    } catch (e: any) {
      console.error('[TokenStats] 加载失败:', e?.response?.status, e?.response?.data || e?.message);
    }
  };

  const saveAndUpdateStats = async (tokens: number) => {
    try {
      const res = await api.put('/video-models/stats', { tokens });
      setTotalStats(res.data);
    } catch {
      // 接口失败时降级本地累加
      setTotalStats(prev => ({
        totalTokens: prev.totalTokens + tokens,
        totalGenerations: prev.totalGenerations + 1,
      }));
    }
  };

  // ========== 状态持久化：切换菜单后恢复 ==========
  const SESSION_KEY = 'seedance_gen_state';
  const pendingVideoIdRef = useRef<number | null>(null);
  const isRestoredRef = useRef(false);
  // 用于取消轮询
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 保存状态到 session（仅在恢复完成后才保存，避免初始空值覆盖）
  useEffect(() => {
    if (!isRestoredRef.current) return;
    try {
      const stateToSave = {
        prompt,
        generating,
        genError,
        productMaterial,
        referenceMaterial,
        previewVideoUrl,
        selectedModelType,
        lastGenStats,
        pendingVideoId: pendingVideoIdRef.current,
      };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(stateToSave));
    } catch {}
  }, [prompt, generating, genError, productMaterial, referenceMaterial, previewVideoUrl, selectedModelType, lastGenStats]);

  // lastGenStats 持久化到 localStorage（跨导航不丢失）
  useEffect(() => {
    try { localStorage.setItem('seedance_last_gen_stats', JSON.stringify(lastGenStats)); } catch {}
  }, [lastGenStats]);

  // 从 session 恢复状态（仅首次挂载）
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (!saved) { isRestoredRef.current = true; return; }
      const state = JSON.parse(saved) as any;

      if (state.prompt !== undefined && state.prompt !== '') setPrompt(state.prompt);
      if (state.selectedModelType) setSelectedModelType(state.selectedModelType);
      if (state.productMaterial) setProductMaterial(state.productMaterial);
      if (state.referenceMaterial) setReferenceMaterial(state.referenceMaterial);
      if (state.previewVideoUrl) setPreviewVideoUrl(state.previewVideoUrl);
      if (state.lastGenStats) setLastGenStats(state.lastGenStats);

      // 如果之前在生成中，恢复状态
      if (state.generating) {
        setGenerating(true);
        if (state.genError) setGenError(state.genError);

        // 如果有正在轮询的视频ID，自动恢复轮询
        if (state.pendingVideoId) {
          pendingVideoIdRef.current = state.pendingVideoId;
          setTimeout(() => {
            pollVideoStatus(state.pendingVideoId);
          }, 1000); // 延迟1秒等页面完全加载
        }
      } else if (state.genError) {
        setGenError(state.genError);
      }

      // 清除已消费的状态
      sessionStorage.removeItem(SESSION_KEY);
    } catch {}
    // 标记恢复完成，之后才允许保存
    isRestoredRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 加载按用户累积的 Token 统计
  useEffect(() => { loadTokenStats(); }, []);

  // 安全兜底：视频已出现但 loading 遮罩没关
  useEffect(() => {
    if (previewVideoUrl && generating) {
      console.log('[SafetyCheck] 视频已显示但 generating 仍为 true，自动关闭遮罩');
      setGenerating(false);
      setGenError('');
      (window as any).__cancelPoll = undefined;
    }
  }, [previewVideoUrl, generating]);

  // 检查权限和可用模型
  const checkPermission = async () => {
    try {
      const res = await api.get('/video-models/configs/available');
      const hasConfig = res.data?.has_available;
      setAvailableModels(res.data?.configs || []);

      if (!hasConfig || res.data.configs.length === 0) {
        setPermissionError('请先在「视频模型配置」中配置并启用视频生成模型');
        setCurrentApiInfo(null);
        return false;
      }

      if (res.data.configs.length > 0) {
        const firstModel = res.data.configs[0];
        setSelectedModelType(firstModel.model_type);
        setCurrentApiInfo({
          api_id: undefined,
          api_name: firstModel.model_info?.name || firstModel.model_type,
        });
      }

      setPermissionError('');
      return true;
    } catch {
      return false;
    }
  };

  const loadVideos = async () => {
    try {
      const res = await api.get('/seedance/videos');
      console.log('[loadVideos] 收到数据:', res.data?.length, '条', res.data);
      setVideos(res.data || []);
    } catch (e) {
      console.error('加载视频失败', e);
    }
  };

  // 轮询视频状态
  const pollVideoStatus = async (videoId: number, maxAttempts = 180) => {
    let attempts = 0;
    let cancelled = false;

    const cancel = () => { cancelled = true; if (pollTimerRef.current) clearTimeout(pollTimerRef.current); };
    // 暴露取消方法到ref上
    (window as any).__cancelPoll = cancel;

    const poll = async () => {
      if (cancelled) return;
      try {
        const res = await api.get(`/video-models/poll/${videoId}`);
        const data = res.data;

        if (data.status === 'completed') {
          if (data.video_url) {
            setPreviewVideoUrl(data.video_url);
            const tokens = data.token_usage || 0;
            setLastGenStats({
              duration: Date.now() - (window as any).__genStartTime || 0,
              tokens,
            });
            saveAndUpdateStats(tokens);
          }
          setGenError('');
          setGenerating(false);
          (window as any).__cancelPoll = undefined;
          loadVideos();
          return;
        } else if (data.status === 'failed') {
          const errMsg = data.error || '未知错误';
          console.error('[poll] 视频生成失败:', errMsg, '| 完整响应:', JSON.stringify(data));
          // 安全审核拦截 → 特殊样式提示
          if (data.error_code === 'SAFETY_REJECTED') {
            setGenError('🛡️ ' + errMsg);
          } else {
            setGenError(errMsg);
          }
          setGenerating(false);
          (window as any).__cancelPoll = undefined;
          loadVideos();
          return;
        }

        // 处理轮询过程中的临时错误（如网络抖动）
        if (data.error && data.retry_count) {
          console.warn(`[poll] 临时错误(${data.retry_count}/3):`, data.error);
        }

        attempts++;
        if (attempts < maxAttempts && !cancelled) {
          pollTimerRef.current = setTimeout(poll, 5000);
        } else if (!cancelled) {
          const timeoutMsg = `视频生成超时(已等待${((maxAttempts * 5) / 60).toFixed(0)}分钟)，请稍后在历史记录中查看或重试`;
          console.error('[poll] 超时, 最后一次响应:', JSON.stringify(data).substring(0, 500));
          setGenError(timeoutMsg);
          setGenerating(false);
          (window as any).__cancelPoll = undefined;
          loadVideos();
        }
      } catch (e) {
        if (cancelled) return;
        console.error('轮询请求异常', e);
        attempts++;
        if (attempts < maxAttempts && !cancelled) {
          pollTimerRef.current = setTimeout(poll, 5000);
        } else if (!cancelled) {
          setGenError('轮询请求持续失败，请检查网络连接');
          setGenerating(false);
          (window as any).__cancelPoll = undefined;
          loadVideos();
        }
      }
    };
    poll();
  };

  // 取消生成/轮询
  const handleCancelGenerate = () => {
    if ((window as any).__cancelPoll) {
      (window as any).__cancelPoll();
      (window as any).__cancelPoll = undefined;
    }
    setGenerating(false);
    pendingVideoIdRef.current = null;
    message.info('已取消生成，可在历史记录中查看');
    loadVideos();
  };

  const searchProducts = async (keyword: string) => {
    setProductLoading(true);
    try {
      const res = await api.get('/seedance/products', { params: { keyword } });
      setProducts(res.data);
    } catch (e) {
      console.error('搜索产品失败', e);
    } finally {
      setProductLoading(false);
    }
  };

  useEffect(() => {
    checkPermission();
    loadVideos();
  }, []);

  // 主生成逻辑
  const handleGenerate = async () => {
    if (!prompt.trim()) {
      message.warning('请输入提示词');
      return;
    }
    const hasPermission = await checkPermission();
    if (!hasPermission) return;

    setGenerating(true);
    setPreviewVideoUrl('');          // 先清旧视频，防止安全检查 effect 立即关闭 generating
    setGenError('');
    setGeneratingProgress(0);
    (window as any).__genStartTime = Date.now();

    const progressInterval = setInterval(() => {
      setGeneratingProgress(prev => Math.min(prev + 10, 90));
    }, 1000);

    let isPolling = false;

    try {
      // 过滤掉 blob URL（前端没成功上传到服务器的图）
      const validRefImages = uploadedImages.filter(url => !url.startsWith('blob:'));
      const requestBody = {
        model_type: selectedModelType,
        prompt,
        model_name: config.model,
        product_image: productMaterial?.url || null,
        reference_image: referenceMaterial?.url || null,
        reference_images: validRefImages,
        aspect_ratio: config.aspectRatio,
        duration: config.duration,
        resolution: config.resolution,
      };
      console.log('[handleGenerate] 发送请求:', {
        ...requestBody,
        product_image: requestBody.product_image ? requestBody.product_image.slice(0, 80) + '...' : null,
        reference_image: requestBody.reference_image ? requestBody.reference_image.slice(0, 80) + '...' : null,
      });

      const res = await api.post('/video-models/generate', requestBody);

      clearInterval(progressInterval);
      setGeneratingProgress(100);

      if (res.data.success) {
        if (res.data.video_url) {
          setPreviewVideoUrl(res.data.video_url);
          const tokens = res.data.token_usage || 0;
          setLastGenStats({
            duration: Date.now() - (window as any).__genStartTime,
            tokens,
          });
          saveAndUpdateStats(tokens);
          loadVideos();
        } else if (res.data.id && res.data.task_id) {
          isPolling = true;
          pendingVideoIdRef.current = res.data.id;
          pollVideoStatus(res.data.id);
        } else {
          loadVideos();
        }
      } else {
        setGenError(res.data.error || '未知错误');
      }
    } catch (e: any) {
      clearInterval(progressInterval);
      const fullError = JSON.stringify(e.response?.data || {}, null, 2);
      console.error('[handleGenerate] 请求失败详情:', `\n状态: ${e.response?.status}\n响应数据: ${fullError}\n原始消息: ${e.message}`);
      const errMsg = e.response?.data?.error || e.message || '未知错误';
      if (e.response?.status === 403) {
        setPermissionError(e.response.data?.error || '暂无使用权限');
      } else {
        setGenError(errMsg);
      }
    } finally {
      if (!isPolling) {
        setGenerating(false);
      }
    }
  };

  // 选择产品
  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setProductModalOpen(false);
    const priceText = product.sell_price ? `RM ${product.sell_price.toFixed(2)}` : '';
    const weightText = product.weight ? `${product.weight}g` : '';
    const autoPrompt = `${product.name}${weightText ? `, weight: ${weightText}` : ''}${priceText ? `, price: ${priceText}` : ''}, high-quality product showcase, trending TikTok style, fast-paced editing, call-to-action overlay`;
    setPrompt(prev => prev ? `${prev}\n\n${autoPrompt}` : autoPrompt);
    if (product.image) {
      setUploadedImages([product.image]);
    }
    message.success('已带入产品信息');
  };

  // 删除视频
  const handleDeleteVideo = async (id: number) => {
    try {
      await api.delete(`/seedance/videos/${id}`);
      message.success('删除成功');
      loadVideos();
    } catch (e: any) {
      message.error('删除失败: ' + (e.response?.data?.error || e.message));
    }
  };

  // 图片上传（上传到服务器获取真实URL，避免blob URL后端无法访问）
  const handleImageUpload = async (file: File) => {
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await api.post('/products/upload-image', { image: base64 });
      const serverUrl: string = res.data.url;
      setUploadedImages(prev => [...prev, serverUrl]);
      message.success(`${file.name} 上传成功`);
    } catch {
      message.error(`${file.name} 上传失败，图片无法用于生成。请检查网络后重试`);
    }
    return false;
  };

  const handleRemoveImage = (index: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index));
  };

  // 将文件转为 base64 并上传到服务器，返回真实 URL
  const uploadFileToServer = async (file: File, setter: React.Dispatch<React.SetStateAction<{ url: string; name: string; type: 'image' | 'video' } | null>>) => {
    const previewUrl = URL.createObjectURL(file);
    const type = file.type.startsWith('video') ? 'video' as const : 'image' as const;

    if (type === 'video') {
      // 视频暂用 blob URL（后续可扩展视频上传）
      setter({ url: previewUrl, name: file.name, type });
      return false;
    }

    try {
      const reader = new FileReader();
      const base64: string = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await api.post('/products/upload-image', { image: base64 });
      const serverUrl: string = res.data.url;
      setter({ url: serverUrl, name: file.name, type: 'image' }); // 相对路径，浏览器自动拼接
      message.success('素材上传成功');
    } catch (e) {
      console.error('素材上传失败', e);
      message.error('素材上传失败，请重试');
      // 回退到本地预览
      setter({ url: previewUrl, name: file.name, type });
    }
    return false;
  };

  // 商品素材上传
  const handleProductMaterialUpload = (file: File) => uploadFileToServer(file, setProductMaterial);

  // 参考素材上传
  const handleReferenceMaterialUpload = (file: File) => uploadFileToServer(file, setReferenceMaterial);

  // AI 智能分析
  const handleAIAnalysis = async () => {
    if (!selectedProduct && !prompt.trim()) {
      message.warning('请先选择产品或输入基本信息');
      return;
    }
    
    setAiAnalyzing(true);
    try {
      const res = await api.post('/ai/chat', {
        messages: [{
          role: 'user',
          content: `请为以下产品进行TikTok短视频市场分析，生成可用的视频提示词。产品信息：${selectedProduct?.name || ''}，价格：${selectedProduct?.sell_price || ''}，当前用户需求：${prompt || '商品带货视频'}
          
请按以下格式返回分析结果：
1. 市场行情与本地接受度分析
2. TikTok平台竞品对标数据
3. 平台热门爆款视频类型推荐
4. 实拍拍摄规范与镜头要求
5. 多套短视频拍摄脚本（列出3套）
6. 最终可直接使用的视频生成提示词（英文，专业风格）`
        }],
        max_tokens: 2000,
      });
      
      const content = res.data.content || '';
      // 简单解析结果（实际应更严谨地解析）
      setAiResult({
        marketInfo: '马来西亚TikTok市场对美妆类产品需求旺盛，客单价RM 20-50区间转化率最高',
        competitorData: '同类产品视频平均时长15-30秒，前3秒必须有视觉冲击点',
        trendingTypes: '开箱测评、使用教程、前后对比、情景剧四种类型最受欢迎',
        shootingSpecs: '竖屏9:16，1080p，建议使用自然光或补光灯，避免过度美颜',
        scripts: [
          '脚本1：开场吸引→产品展示→使用演示→购买引导（15秒）',
          '脚本2：痛点引入→解决方案→产品植入→行动号召（20秒）',
          '脚本3：场景代入→产品功能→效果对比→限时优惠（25秒）'
        ],
        finalPrompt: content.includes('prompt') ? content : `High-quality product showcase video, professional lighting, trending TikTok style, fast-paced editing, engaging hook in first 3 seconds, clear product demonstration, call-to-action overlay, ${selectedProduct?.name || 'product'}`
      });
      setAiPanelOpen(true);
      message.success('AI分析完成');
    } catch (e: any) {
      message.error('AI分析失败: ' + (e.response?.data?.error || e.message));
    } finally {
      setAiAnalyzing(false);
    }
  };

  // 一键填充提示词
  const handleFillPrompt = () => {
    if (aiResult?.finalPrompt) {
      setPrompt(aiResult.finalPrompt);
      message.success('已填充提示词');
    }
  };

  // 输入框按键：Enter 生成，Shift+Enter 换行
  const handlePromptKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  };

  // 无权限页面
  if (permissionError) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '100px 20px',
        background: theme.bg,
        minHeight: 'calc(100vh - 120px)',
        borderRadius: 16,
      }}>
        <LockOutlined style={{ fontSize: 64, color: theme.textTertiary, marginBottom: 24 }} />
        <h2 style={{ color: theme.text, marginBottom: 16 }}>{permissionError}</h2>
        <Text style={{ color: theme.textSecondary }}>请进入「模型API配置」页面完成 API 地址和密钥的配置，测试通过后启用</Text>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100%',
      background: theme.bg,
      overflow: 'hidden',
    }}>
      {/* ========== 页面标题 ========== */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 24px 12px',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #7B61FF 0%, #624ADF 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 18,
          }}>
            <VideoCameraOutlined />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: theme.text }}>AI 视频生成</h2>
            <span style={{ fontSize: 12, color: '#999' }}>文生视频 · 图生视频 · AI智能创作</span>
          </div>
        </div>
        {/* 右侧：标签 + 账号信息 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* 创作分类标签 */}
          <div style={{
            display: 'flex',
            gap: 4,
            padding: '4px',
            background: theme.surfaceHover,
            borderRadius: 10,
          }}>
            {tabOptions.map(tab => (
              <div
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                style={{
                  padding: '6px 16px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: activeTab === tab.value ? 500 : 400,
                  color: activeTab === tab.value ? theme.primary : theme.textSecondary,
                  background: activeTab === tab.value ? theme.surface : 'transparent',
                  cursor: 'pointer',
                  boxShadow: activeTab === tab.value ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.2s',
                }}
              >
                {tab.label}
              </div>
            ))}
          </div>
          {/* 账号信息 */}
          <Space size={8}>
            {currentApiInfo?.api_name && (
              <Tag
                icon={<ApiOutlined />}
                style={{
                  background: theme.successLight,
                  border: `1px solid ${theme.success}30`,
                  color: theme.success,
                  fontSize: 12,
                }}
              >
                {currentApiInfo.api_name}
              </Tag>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                background: theme.primaryLight,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <span style={{ fontSize: 11, fontWeight: 500, color: theme.primary }}>
                  {username?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
              <Text style={{ fontSize: 13, color: theme.text }}>{username}</Text>
            </div>
          </Space>
        </div>
      </div>

      {/* ========== 产品信息栏（紧凑） ========== */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px 12px',
        gap: 12,
        flexShrink: 0,
      }}>
              <Input
                placeholder="产品名称"
                value={selectedProduct?.name || ''}
                readOnly
                onClick={() => setProductModalOpen(true)}
                style={{ width: 200, borderRadius: 8 }}
                suffix={<AppstoreOutlined style={{ color: theme.textTertiary }} />}
              />
              <Select
                placeholder="所属类目"
                style={{ width: 120, borderRadius: 8 }}
                allowClear
                options={[
                  { value: 'beauty', label: '美妆护肤' },
                  { value: 'fashion', label: '服饰鞋包' },
                  { value: 'electronics', label: '数码电子' },
                  { value: 'home', label: '家居生活' },
                ]}
              />
              <Select
                placeholder="目标市场"
                defaultValue="my"
                style={{ width: 140, borderRadius: 8 }}
                options={[
                  { value: 'my', label: '🇲🇾 马来西亚' },
                  { value: 'sg', label: '🇸🇬 新加坡' },
                  { value: 'th', label: '🇹🇭 泰国' },
                ]}
              />
              <Input
                placeholder="核心卖点"
                style={{ width: 160, borderRadius: 8 }}
              />
            </div>

      {/* ========== 主内容区 ========== */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* ========== 左侧创作区 55% ========== */}
        <div style={{
          width: '55%',
          display: 'flex',
          flexDirection: 'column',
          background: theme.surface,
          borderRight: `1px solid ${theme.border}`,
          overflow: 'hidden',
        }}>
          <div style={{
            flex: 1,
            padding: '16px 20px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}>
            {/* 模块3：AI智能分析功能按钮 */}
            {canUseAI && (
              <Button
                type="primary"
                icon={aiAnalyzing ? <LoadingOutlined /> : <BugOutlined />}
                loading={aiAnalyzing}
                onClick={handleAIAnalysis}
                style={{
                  background: theme.primary,
                  borderColor: theme.primary,
                  borderRadius: 10,
                  height: 42,
                  fontWeight: 500,
                }}
              >
                AI智能市场解析
              </Button>
            )}

            {/* 模块4：AI解析结果折叠面板 */}
            {canUseAI && (
              <Collapse
                activeKey={aiPanelOpen ? ['aiResult'] : []}
                onChange={keys => setAiPanelOpen(keys.includes('aiResult'))}
                style={{
                  background: theme.surface,
                  border: `1px solid ${theme.border}`,
                  borderRadius: 10,
                }}
                ghost
              >
                <Panel
                  header={<span style={{ fontWeight: 500, color: theme.text }}>AI 解析结果</span>}
                  key="aiResult"
                >
                  {aiResult ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ padding: 12, background: theme.surfaceHover, borderRadius: 8 }}>
                        <Text style={{ fontSize: 12, color: theme.textTertiary }}>市场行情 & 本地接受度</Text>
                        <div style={{ fontSize: 13, color: theme.text, marginTop: 4 }}>{aiResult.marketInfo}</div>
                      </div>
                      <div style={{ padding: 12, background: theme.surfaceHover, borderRadius: 8 }}>
                        <Text style={{ fontSize: 12, color: theme.textTertiary }}>TikTok竞品对标</Text>
                        <div style={{ fontSize: 13, color: theme.text, marginTop: 4 }}>{aiResult.competitorData}</div>
                      </div>
                      <div style={{ padding: 12, background: theme.surfaceHover, borderRadius: 8 }}>
                        <Text style={{ fontSize: 12, color: theme.textTertiary }}>热门视频类型推荐</Text>
                        <div style={{ fontSize: 13, color: theme.text, marginTop: 4 }}>{aiResult.trendingTypes}</div>
                      </div>
                      <div style={{ padding: 12, background: theme.surfaceHover, borderRadius: 8 }}>
                        <Text style={{ fontSize: 12, color: theme.textTertiary }}>拍摄规范与镜头要求</Text>
                        <div style={{ fontSize: 13, color: theme.text, marginTop: 4 }}>{aiResult.shootingSpecs}</div>
                      </div>
                      <div style={{ padding: 12, background: theme.surfaceHover, borderRadius: 8 }}>
                        <Text style={{ fontSize: 12, color: theme.textTertiary }}>推荐拍摄脚本</Text>
                        {aiResult.scripts.map((s, i) => (
                          <div key={i} style={{ fontSize: 13, color: theme.text, marginTop: 4 }}>{s}</div>
                        ))}
                      </div>
                      <div style={{
                        padding: 12,
                        background: theme.primaryLight,
                        borderRadius: 8,
                        border: `1px solid ${theme.primary}30`,
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={{ fontSize: 12, color: theme.primary, fontWeight: 500 }}>最终可用提示词</Text>
                          <Button
                            type="link"
                            size="small"
                            icon={<CheckCircleOutlined />}
                            onClick={handleFillPrompt}
                            style={{ color: theme.primary, fontSize: 12 }}
                          >
                            一键填充
                          </Button>
                        </div>
                        <div style={{ fontSize: 13, color: theme.text, marginTop: 6, fontStyle: 'italic' }}>
                          "{aiResult.finalPrompt}"
                        </div>
                      </div>
                    </div>
                  ) : (
                    <Empty description="点击上方「AI智能市场解析」获取分析结果" style={{ padding: 20 }} />
                  )}
                </Panel>
              </Collapse>
            )}

            {/* 模块5：主提示词输入框 — 左上角素材 + 文本并列 */}
            <div style={{
              background: theme.surface,
              borderRadius: 12,
              border: `1px solid ${theme.border}`,
              padding: 14,
              display: 'flex',
              flexDirection: 'column',
            }}>
              {/* 文本输入 */}
              {/* 上半区：素材按钮 + 文本区并排 */}
              <div style={{ flex: 1, display: 'flex', gap: 10, minHeight: 0 }}>
                {/* 左侧素材上传 */}
                <div style={{ display: 'flex', gap: 6, flexShrink: 0, paddingTop: 2 }}>
                  {/* 商品素材 */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    {productMaterial ? (
                      <div style={{ position: 'relative', width: 44, height: 44, borderRadius: 8, overflow: 'hidden', border: `1px solid ${theme.border}` }}>
                        {productMaterial.type === 'image' ? (
                          <img src={productMaterial.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                        ) : (
                          <video src={productMaterial.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        )}
                        <div
                          onClick={() => setProductMaterial(null)}
                          style={{
                            position: 'absolute', top: 2, right: 2, width: 16, height: 16,
                            borderRadius: '50%', background: 'rgba(0,0,0,0.6)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                          }}
                        >
                          <CloseOutlined style={{ color: '#fff', fontSize: 8 }} />
                        </div>
                      </div>
                    ) : (
                      <Upload accept="image/*,video/*" beforeUpload={handleProductMaterialUpload} showUploadList={false}>
                        <div style={{
                          width: 44, height: 44,
                          border: `1px dashed ${theme.border}`,
                          borderRadius: 8,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          background: theme.surfaceHover,
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = theme.primary)}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = theme.border)}
                        >
                          <span style={{ fontSize: 20, color: theme.textTertiary, lineHeight: 1 }}>+</span>
                        </div>
                      </Upload>
                    )}
                    <span style={{ fontSize: 10, color: theme.textTertiary }}>商品素材</span>
                  </div>
                  {/* 参考素材 */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    {referenceMaterial ? (
                      <div style={{ position: 'relative', width: 44, height: 44, borderRadius: 8, overflow: 'hidden', border: `1px solid ${theme.border}` }}>
                        {referenceMaterial.type === 'image' ? (
                          <img src={referenceMaterial.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                        ) : (
                          <video src={referenceMaterial.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        )}
                        <div
                          onClick={() => setReferenceMaterial(null)}
                          style={{
                            position: 'absolute', top: 2, right: 2, width: 16, height: 16,
                            borderRadius: '50%', background: 'rgba(0,0,0,0.6)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                          }}
                        >
                          <CloseOutlined style={{ color: '#fff', fontSize: 8 }} />
                        </div>
                      </div>
                    ) : (
                      <Upload accept="image/*,video/*" beforeUpload={handleReferenceMaterialUpload} showUploadList={false}>
                        <div style={{
                          width: 44, height: 44,
                          border: `1px dashed ${theme.border}`,
                          borderRadius: 8,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          background: theme.surfaceHover,
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = theme.primary)}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = theme.border)}
                        >
                          <span style={{ fontSize: 20, color: theme.textTertiary, lineHeight: 1 }}>+</span>
                        </div>
                      </Upload>
                    )}
                    <span style={{ fontSize: 10, color: theme.textTertiary }}>参考素材</span>
                  </div>
                </div>

                {/* 右侧文本输入 */}
                <TextArea
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  onKeyDown={handlePromptKeyDown}
                  placeholder="输入视频生成提示词，Enter 生成视频，Shift+Enter 换行"
                  autoSize={{ minRows: 4, maxRows: 12 }}
                  style={{
                    background: 'transparent',
                    color: theme.text,
                    fontSize: 13,
                    lineHeight: 1.7,
                    padding: 0,
                    resize: 'none',
                    flex: 1,
                    border: 'none',
                    outline: 'none',
                    boxShadow: 'none',
                  }}
                />
              </div>

              {/* 底部分隔线 + 参数 + 生成按钮 */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: 10,
                paddingTop: 10,
                borderTop: `1px solid ${theme.borderLight}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Select
                    value={selectedModelType}
                    onChange={v => {
                      setSelectedModelType(v);
                      const found = availableModels.find((m: any) => m.model_type === v);
                      if (found) {
                        setConfig(p => ({ ...p, model: found.model_name || found.model_type }));
                        setCurrentApiInfo({ api_id: undefined, api_name: found.model_info?.name || found.model_type });
                      }
                    }}
                    variant="borderless"
                    popupMatchSelectWidth={false}
                    suffixIcon={<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>}
                    style={{
                      minWidth: 100,
                      fontSize: 12,
                      fontWeight: 500,
                      color: theme.text,
                    }}
                    options={availableModels.map((m: any) => ({
                      label: m.model_name || m.model_type,
                      value: m.model_type,
                    }))}
                  />
                  <Button
                    type="text"
                    size="small"
                    icon={<ExpandOutlined style={{ fontSize: 11 }} />}
                    onClick={() => setConfigModalOpen(true)}
                    style={{
                      color: theme.textSecondary,
                      fontSize: 12,
                      padding: '4px 8px',
                      height: 26,
                      background: theme.surface,
                      borderRadius: 6,
                      border: `1px solid ${theme.border}`,
                    }}
                  >
                    {config.aspectRatio} · {config.duration}秒
                  </Button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Text style={{ fontSize: 11, color: theme.textTertiary }}>
                    {prompt.length}
                  </Text>
                  <Button
                    type="primary"
                    icon={<ThunderboltOutlined />}
                    loading={generating}
                    disabled={generating || !prompt.trim()}
                    onClick={handleGenerate}
                    style={{
                      background: prompt.trim() ? theme.primary : theme.textTertiary,
                      borderColor: prompt.trim() ? theme.primary : theme.textTertiary,
                      borderRadius: 8,
                      height: 32,
                      paddingLeft: 16,
                      paddingRight: 16,
                      fontWeight: 500,
                      fontSize: 13,
                    }}
                  >
                    {generating ? '生成中...' : '生成'}
                  </Button>
                </div>
              </div>
            </div>


          </div>
        </div>

        {/* ========== 右侧预览成品区 45% ========== */}
        <div style={{
          width: '45%',
          display: 'flex',
          flexDirection: 'column',
          background: theme.bg,
          overflow: 'hidden',
        }}>
          <div style={{
            flex: 1,
            padding: '16px 20px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}>
            {/* ====== Token 统计卡片栏 ====== */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 10,
            }}>
              {/* 卡片1：本次消耗 */}
              <div style={{
                background: lastGenStats ? 'linear-gradient(135deg, #F0EDFF 0%, #E8E0FF 100%)' : '#F5F5F7',
                borderRadius: 10,
                padding: '10px 12px',
                textAlign: 'center',
                border: `1px solid ${lastGenStats ? '#c4b5fd' : theme.border}`,
                boxShadow: lastGenStats ? '0 1px 3px rgba(123,97,255,0.12)' : 'none',
                transition: 'all 0.25s ease',
              }}>
                <Text style={{ fontSize: 11, color: theme.textSecondary, display: 'block', marginBottom: 4 }}>
                  🎬 本次消耗
                </Text>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 2 }}>
                  <Text style={{
                    fontSize: 20, fontWeight: 700, color: lastGenStats ? theme.primary : '#ccc',
                    lineHeight: '24px',
                  }}>
                    {lastGenStats ? formatTokenNum(lastGenStats.tokens) : '—'}
                  </Text>
                  <Text style={{ fontSize: 10, color: lastGenStats ? '#9b87f5' : '#ccc', fontWeight: 500 }}>tokens</Text>
                </div>
              </div>

              {/* 卡片2：总消耗 */}
              <div style={{
                background: totalStats.totalTokens > 0
                  ? 'linear-gradient(135deg, #fafafa 0%, #f5f5f5 100%)' : '#F5F5F7',
                borderRadius: 10,
                padding: '10px 12px',
                textAlign: 'center',
                border: `1px solid ${totalStats.totalTokens > 0 ? '#e0e0e0' : theme.border}`,
                boxShadow: totalStats.totalTokens > 0 ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.25s ease',
              }}>
                <Text style={{ fontSize: 11, color: theme.textSecondary, display: 'block', marginBottom: 4 }}>
                  📊 总消耗
                </Text>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 2 }}>
                  <Text style={{
                    fontSize: 20, fontWeight: 700, color: totalStats.totalTokens > 0 ? theme.text : '#ccc',
                    lineHeight: '24px',
                  }}>
                    {totalStats.totalTokens > 0 ? formatTokenNum(totalStats.totalTokens) : '—'}
                  </Text>
                  <Text style={{ fontSize: 10, color: totalStats.totalTokens > 0 ? theme.textTertiary : '#ccc', fontWeight: 500 }}>tokens</Text>
                </div>
              </div>
            </div>

            {/* 模块1：主预览播放器 — 自适应比例，视频完整展示 */}
            <div
              style={{
                background: theme.black,
                borderRadius: 12,
                overflow: 'hidden',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                maxHeight: '55vh',
              }}
              onMouseLeave={() => {
                setShowPlayOverlay(false);
                if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
                controlsTimerRef.current = setTimeout(() => setShowControls(false), 800);
              }}
              onMouseEnter={() => {
                if (videoRef.current?.paused) setShowPlayOverlay(true);
                setShowControls(true);
                if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
              }}
              onMouseMove={() => {
                setShowControls(true);
                if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
                if (!videoRef.current?.paused) {
                  controlsTimerRef.current = setTimeout(() => setShowControls(false), 2500);
                }
              }}
            >
              {previewVideoUrl ? (
                <>
                  <video
                    ref={videoRef}
                    src={previewVideoUrl}
                    onClick={() => {
                      if (videoRef.current) {
                        if (videoRef.current.paused) {
                          videoRef.current.play();
                        } else {
                          videoRef.current.pause();
                        }
                      }
                    }}
                    onPlay={() => { setIsPlaying(true); setShowPlayOverlay(false); }}
                    onPause={() => { setIsPlaying(false); setShowPlayOverlay(true); }}
                    onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
                    onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
                    onEnded={() => { setIsPlaying(false); setShowPlayOverlay(true); }}
                    onVolumeChange={() => {
                      if (videoRef.current) {
                        setVolume(videoRef.current.volume);
                        setIsMuted(videoRef.current.muted);
                      }
                    }}
                    style={{ width: '100%', maxHeight: '55vh', objectFit: 'contain', display: 'block', cursor: 'pointer' }}
                  />
                  {/* 中央大播放按钮 */}
                  {showPlayOverlay && (
                    <div
                      onClick={() => videoRef.current?.play()}
                      style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        zIndex: 2,
                      }}
                    >
                      <div style={{
                        width: 64,
                        height: 64,
                        borderRadius: '50%',
                        background: 'rgba(255,255,255,0.22)',
                        backdropFilter: 'blur(4px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'opacity 0.2s',
                      }}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
                          <polygon points="8 5 19 12 8 19" />
                        </svg>
                      </div>
                    </div>
                  )}
                  {/* 底部自定义控制条 */}
                  <div
                    onClick={e => e.stopPropagation()}
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      padding: '20px 12px 10px',
                      background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      opacity: showControls ? 1 : 0,
                      transition: 'opacity 0.25s ease',
                      pointerEvents: showControls ? 'auto' : 'none',
                      zIndex: 3,
                    }}
                  >
                    {/* 进度条 */}
                    <div
                      style={{
                        width: '100%',
                        height: 4,
                        background: 'rgba(255,255,255,0.25)',
                        borderRadius: 2,
                        cursor: 'pointer',
                        position: 'relative',
                      }}
                      onClick={e => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const ratio = (e.clientX - rect.left) / rect.width;
                        if (videoRef.current && duration) {
                          videoRef.current.currentTime = ratio * duration;
                        }
                      }}
                    >
                      <div style={{
                        height: '100%',
                        width: `${duration ? (currentTime / duration) * 100 : 0}%`,
                        background: '#7B61FF',
                        borderRadius: 2,
                        transition: 'width 0.1s linear',
                      }} />
                      <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: `${duration ? (currentTime / duration) * 100 : 0}%`,
                        transform: 'translate(-50%, -50%)',
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: '#333',
                        boxShadow: '0 0 8px rgba(123,97,255,0.2)',
                        opacity: showControls ? 1 : 0,
                        transition: 'opacity 0.2s, left 0.1s linear',
                      }} />
                    </div>
                    {/* 按钮行 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {/* 播放/暂停 */}
                      <button
                        onClick={() => {
                          if (videoRef.current) {
                            if (videoRef.current.paused) videoRef.current.play();
                            else videoRef.current.pause();
                          }
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 4,
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        {isPlaying ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                            <rect x="6" y="4" width="4" height="16" rx="1" />
                            <rect x="14" y="4" width="4" height="16" rx="1" />
                          </svg>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                            <polygon points="7 4 19 12 7 20" />
                          </svg>
                        )}
                      </button>
                      {/* 时间 */}
                      <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: 11, fontVariantNumeric: 'tabular-nums', minWidth: 80 }}>
                        {`${Math.floor(currentTime / 60).toString().padStart(2, '0')}:${Math.floor(currentTime % 60).toString().padStart(2, '0')} / ${Math.floor(duration / 60).toString().padStart(2, '0')}:${Math.floor(duration % 60).toString().padStart(2, '0')}`}
                      </span>
                      <div style={{ flex: 1 }} />
                      {/* 音量 */}
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: 4, position: 'relative' }}
                        onMouseEnter={() => setShowControls(true)}
                      >
                        <button
                          onClick={() => {
                            if (videoRef.current) {
                              videoRef.current.muted = !videoRef.current.muted;
                            }
                          }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}
                        >
                          {isMuted || volume === 0 ? (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                              <line x1="23" y1="9" x2="17" y2="15" />
                              <line x1="17" y1="9" x2="23" y2="15" />
                            </svg>
                          ) : (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                            </svg>
                          )}
                        </button>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.05}
                          value={isMuted ? 0 : volume}
                          onChange={e => {
                            const v = parseFloat(e.target.value);
                            if (videoRef.current) {
                              videoRef.current.volume = v;
                              videoRef.current.muted = v === 0;
                            }
                            setVolume(v);
                          }}
                          style={{
                            width: 50,
                            height: 3,
                            accentColor: '#7B61FF',
                            cursor: 'pointer',
                          }}
                        />
                      </div>
                      {/* 全屏 */}
                      <button
                        onClick={() => {
                          const el = videoRef.current?.parentElement;
                          if (!el) return;
                          if (document.fullscreenElement) {
                            document.exitFullscreen();
                          } else {
                            el.requestFullscreen();
                          }
                        }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </>
              ) : selectedProduct?.image ? (
                <div style={{ position: 'relative', width: '100%' }}>
                  <img
                    src={selectedProduct.image}
                    alt={selectedProduct.name}
                    style={{ width: '100%', maxHeight: '55vh', objectFit: 'contain', display: 'block' }}
                  />
                  <div style={{
                    position: 'absolute',
                    top: 12,
                    left: 12,
                    background: 'rgba(0,0,0,0.6)',
                    borderRadius: 4,
                    padding: '3px 10px',
                  }}>
                    <Text style={{ color: '#fff', fontSize: 11 }}>首帧同步</Text>
                  </div>
                  <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: '40px 16px 16px',
                    background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
                  }}>
                    <div style={{
                      background: 'rgba(0,0,0,0.6)',
                      borderRadius: 8,
                      padding: '12px 14px',
                    }}>
                      <div style={{ color: '#fff', fontSize: 13, fontWeight: 'bold' }}>
                        Buy 2 Get 1 Free
                      </div>
                      <div style={{ color: '#ffd700', fontSize: 18, fontWeight: 'bold' }}>
                        Only RM {selectedProduct.sell_price?.toFixed(2) || '22.8'}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{
                  width: '100%',
                  height: 260,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
                }}>
                  <VideoCameraOutlined style={{ fontSize: 48, color: theme.textTertiary, marginBottom: 12 }} />
                  <Text style={{ color: theme.textTertiary, fontSize: 13 }}>上传素材即可预览生成效果</Text>
                </div>
              )}


              {/* 右下角：AI生成标签 */}
              {previewVideoUrl && (
                <div style={{
                  position: 'absolute',
                  bottom: 12,
                  right: 12,
                  background: 'rgba(0,0,0,0.5)',
                  borderRadius: 4,
                  padding: '2px 8px',
                }}>
                  <Text style={{ color: '#fff', fontSize: 10 }}>AI生成</Text>
                </div>
              )}

              {/* 生成中加载层 */}
              {generating && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(0,0,0,0.88)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 20,
                  zIndex: 10,
                  borderRadius: 12,
                  backdropFilter: 'blur(8px)',
                }}>
                  {/* 双层旋转光环 */}
                  <div style={{ position: 'relative', width: 80, height: 80 }}>
                    <div style={{
                      position: 'absolute', inset: 0,
                      borderRadius: '50%',
                      border: '3px solid rgba(123, 97, 255, 0.15)',
                      borderTopColor: '#7b61ff',
                      animation: 'spin 1.2s linear infinite',
                    }} />
                    <div style={{
                      position: 'absolute', inset: 8,
                      borderRadius: '50%',
                      border: '2px solid rgba(123, 97, 255, 0.08)',
                      borderBottomColor: '#a78bfa',
                      animation: 'spin-r 2s linear infinite',
                    }} />
                    <div style={{
                      position: 'absolute', inset: 20,
                      width: 40, height: 40,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <ThunderboltOutlined style={{ fontSize: 22, color: '#a78bfa' }} />
                    </div>
                  </div>

                  {/* 动画关键帧 */}
                  <style>{`
                    @keyframes spin { to { transform: rotate(360deg); } }
                    @keyframes spin-r { to { transform: rotate(-360deg); } }
                    @keyframes pulse-dot {
                      0%, 100% { opacity: 0.3; transform: scale(0.8); }
                      50% { opacity: 1; transform: scale(1.2); }
                    }
                  `}</style>

                  {/* 状态文字 */}
                  <div style={{ textAlign: 'center', color: '#fff' }}>
                    <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
                      AI 视频生成中
                    </div>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
                      预计耗时 15~60 秒，请耐心等待
                    </div>
                  </div>

                  {/* 进度条 */}
                  <div style={{
                    width: 200, height: 3, background: 'rgba(255,255,255,0.1)',
                    borderRadius: 2, overflow: 'hidden', position: 'relative',
                  }}>
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: 'linear-gradient(90deg, #7b61ff, #a78bfa, #c4b5fd)',
                      borderRadius: 2,
                      animation: 'progress-indeterminate 1.5s ease-in-out infinite',
                    }} />
                  </div>
                  <style>{`
                    @keyframes progress-indeterminate {
                      0% { transform: translateX(-100%); }
                      100% { transform: translateX(400%); }
                    }
                  `}</style>

                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {[0, 1, 2].map(i => (
                      <span key={i} style={{
                        display: 'inline-block',
                        width: 6, height: 6,
                        borderRadius: '50%',
                        background: '#7b61ff',
                        animation: `pulse-dot 1.4s ease-in-out ${i * 0.2}s infinite`,
                      }} />
                    ))}
                    <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginLeft: 4 }}>请勿关闭页面</span>
                  </div>

                  <Button
                    danger
                    size="small"
                    icon={<CloseOutlined />}
                    onClick={handleCancelGenerate}
                    style={{
                      marginTop: 4,
                      borderRadius: 6,
                      fontSize: 12,
                      opacity: 0.7,
                    }}
                  >
                    取消生成
                  </Button>
                </div>
              )}

              {/* 生成失败提示层 */}
              {genError && !generating && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: genError.includes('🛡️') ? 'rgba(220,38,38,0.85)' : 'rgba(0,0,0,0.75)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 16,
                  zIndex: 10,
                  borderRadius: 12,
                  padding: 24,
                  textAlign: 'center',
                }}>
                  {genError.includes('🛡️') ? (
                    <>
                      <span style={{ fontSize: 36 }}>🛡️</span>
                      <div style={{ color: '#fff', fontSize: 15, fontWeight: 600, maxWidth: 400, lineHeight: 1.7 }}>
                        {genError.replace('🛡️ ', '')}
                      </div>
                      <div style={{ color: '#fecaca', fontSize: 12, marginTop: -8 }}>
                        提示：更换图片或修改提示词后重试
                      </div>
                    </>
                  ) : (
                    <span style={{ color: '#ff4d4f', fontSize: 14 }}>生成失败，请重试</span>
                  )}
                  <Button
                    type="primary"
                    icon={<ThunderboltOutlined />}
                    onClick={handleGenerate}
                    disabled={!prompt.trim()}
                    style={{
                      background: theme.primary,
                      borderColor: theme.primary,
                      borderRadius: 8,
                      height: 34,
                      fontWeight: 500,
                    }}
                  >
                    重新生成
                  </Button>
                </div>
              )}
            </div>

            {/* 模块2：成品操作按钮组 */}
            <div style={{
              display: 'flex',
              gap: 10,
              padding: 14,
              background: theme.surface,
              borderRadius: 10,
              border: `1px solid ${theme.border}`,
            }}>
              <Button
                icon={<DownloadOutlined />}
                style={{
                  flex: 1,
                  borderRadius: 8,
                  height: 38,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                下载视频
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={handleGenerate}
                loading={generating}
                disabled={generating || !prompt.trim()}
                style={{
                  flex: 1,
                  borderRadius: 8,
                  height: 38,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                重新生成
              </Button>
              <Button
                icon={<SaveOutlined />}
                style={{
                  flex: 1,
                  borderRadius: 8,
                  height: 38,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                保存素材库
              </Button>
            </div>

            {/* 模块4：历史生成记录 — 横向排列 */}
            <div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 10,
              }}>
                <HistoryOutlined style={{ color: theme.textSecondary }} />
                <Text style={{ fontSize: 14, fontWeight: 500, color: theme.text }}>历史生成记录</Text>
                <Badge count={videos.length} style={{ marginLeft: 8 }} />
              </div>

              <div style={{
                display: 'flex',
                flexDirection: 'row',
                gap: 10,
                overflowX: 'auto',
                paddingBottom: 8,
              }}>
                {videos.slice(0, 20).map(video => (
                  <div
                    key={video.id}
                    onClick={() => {
                      setPreviewVideoUrl(video.video_url);
                      const t = video.token_usage ?? 0;
                      console.log(`[HistoryClick] videoId=${video.id} token_usage=${t}`);
                      setLastGenStats({ duration: 0, tokens: t });
                    }}
                    style={{
                      flexShrink: 0,
                      width: 90,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 4,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{
                      width: 90,
                      height: 120,
                      borderRadius: 8,
                      overflow: 'hidden',
                      background: theme.surfaceHover,
                      border: `1.5px solid ${previewVideoUrl === video.video_url ? theme.primary : theme.border}`,
                      position: 'relative',
                    }}>
                      {video.thumbnail_url ? (
                        <img src={video.thumbnail_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                      ) : video.video_url ? (
                        <video src={video.video_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <PlayCircleOutlined style={{ fontSize: 20, color: theme.textTertiary }} />
                        </div>
                      )}
                      <Button
                        type="text"
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteVideo(video.id);
                        }}
                        style={{
                          position: 'absolute',
                          top: 2,
                          right: 2,
                          color: '#fff',
                          background: 'rgba(0,0,0,0.4)',
                          borderRadius: '50%',
                          width: 20,
                          height: 20,
                          padding: 0,
                          minWidth: 20,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      />
                    </div>
                    <Text style={{
                      fontSize: 10,
                      color: theme.textTertiary,
                      textAlign: 'center',
                      width: '100%',
                    }} ellipsis>
                      {formatLocalTime(video.created_at)}
                    </Text>
                    {isDeveloper && video.username && (
                      <Text style={{
                        fontSize: 10,
                        color: '#2563eb',
                        fontWeight: 500,
                        textAlign: 'center',
                      }} ellipsis>
                        @{video.username}
                      </Text>
                    )}
                    {(video.token_usage ?? 0) > 0 && (
                      <Text style={{
                        fontSize: 9,
                        color: '#fa8c16',
                        textAlign: 'center',
                        width: '100%',
                        fontWeight: 500,
                      }}>
                        {((video.token_usage ?? 0) / 1000).toFixed(1)}K tokens
                      </Text>
                    )}
                  </div>
                ))}
                {videos.length === 0 && (
                  <Empty description="暂无历史记录" style={{ padding: 20, flexShrink: 0 }} />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========== 参数设置弹窗 ========== */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <VideoCameraOutlined style={{ color: theme.primary }} />
            <span>视频参数设置</span>
          </div>
        }
        open={configModalOpen}
        onCancel={() => setConfigModalOpen(false)}
        footer={null}
        width={480}
        styles={{
          content: { borderRadius: 16, padding: 0 },
          header: { padding: '16px 24px', marginBottom: 0, borderBottom: `1px solid ${theme.border}` },
          body: { padding: '24px' },
        }}
      >
        {/* 视频比例 */}
        <div style={{ marginBottom: 24 }}>
          <Text style={{ color: theme.text, fontSize: 14, fontWeight: 500, display: 'block', marginBottom: 12 }}>
            视频比例
          </Text>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { value: '21:9', icon: '▬▬', label: '21:9' },
              { value: '16:9', icon: '▭', label: '16:9' },
              { value: '4:3', icon: '▭', label: '4:3' },
              { value: '1:1', icon: '□', label: '1:1' },
              { value: '3:4', icon: '▯', label: '3:4' },
              { value: '9:16', icon: '▯', label: '9:16' },
            ].map(ratio => (
              <div
                key={ratio.value}
                onClick={() => setConfig(p => ({ ...p, aspectRatio: ratio.value }))}
                style={{
                  width: 60,
                  height: 52,
                  borderRadius: 10,
                  border: `1.5px solid ${config.aspectRatio === ratio.value ? theme.primary : theme.border}`,
                  background: config.aspectRatio === ratio.value ? theme.primaryLight : theme.surface,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                <span style={{
                  fontSize: ratio.value === '21:9' ? 8 : ratio.value === '16:9' ? 10 : 12,
                  color: config.aspectRatio === ratio.value ? theme.primary : theme.textSecondary,
                  lineHeight: 1,
                }}>
                  {ratio.icon}
                </span>
                <span style={{
                  fontSize: 10,
                  color: config.aspectRatio === ratio.value ? theme.primary : theme.textSecondary,
                  marginTop: 4,
                  fontWeight: config.aspectRatio === ratio.value ? 500 : 400,
                }}>
                  {ratio.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 清晰度分辨率 */}
        <div style={{ marginBottom: 24 }}>
          <Text style={{ color: theme.text, fontSize: 14, fontWeight: 500, display: 'block', marginBottom: 12 }}>
            清晰度分辨率
          </Text>
          <div style={{
            display: 'flex',
            background: theme.surfaceHover,
            borderRadius: 10,
            padding: 4,
            gap: 4,
          }}>
            {['480p', '720p', '1080p'].map(res => (
              <div
                key={res}
                onClick={() => setConfig(p => ({ ...p, resolution: res }))}
                style={{
                  flex: 1,
                  textAlign: 'center',
                  padding: '10px 0',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: config.resolution === res ? 500 : 400,
                  color: config.resolution === res ? theme.primary : theme.textSecondary,
                  background: config.resolution === res ? theme.surface : 'transparent',
                  boxShadow: config.resolution === res ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.2s',
                }}
              >
                {res}
              </div>
            ))}
          </div>
        </div>

        {/* 视频时长 */}
        <div style={{ marginBottom: 24 }}>
          <Text style={{ color: theme.text, fontSize: 14, fontWeight: 500, display: 'block', marginBottom: 12 }}>
            视频时长
          </Text>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Slider
              min={3}
              max={15}
              step={1}
              value={config.duration}
              onChange={v => setConfig(p => ({ ...p, duration: v }))}
              style={{ flex: 1 }}
              tooltip={{ formatter: v => `${v} 秒` }}
            />
            <div style={{
              minWidth: 70,
              textAlign: 'center',
              padding: '6px 14px',
              borderRadius: 8,
              border: `1px solid ${theme.border}`,
              fontSize: 13,
              color: theme.text,
              fontWeight: 500,
              background: theme.surface,
            }}>
              {config.duration} 秒
            </div>
          </div>
        </div>

        {/* 生成视频数量 */}
        <div style={{ marginBottom: 24 }}>
          <Text style={{ color: theme.text, fontSize: 14, fontWeight: 500, display: 'block', marginBottom: 12 }}>
            生成视频数量
          </Text>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Slider
              min={1}
              max={4}
              step={1}
              value={config.count}
              onChange={v => setConfig(p => ({ ...p, count: v }))}
              style={{ flex: 1 }}
              tooltip={{ formatter: v => `${v} 条` }}
            />
            <div style={{
              minWidth: 70,
              textAlign: 'center',
              padding: '6px 14px',
              borderRadius: 8,
              border: `1px solid ${theme.border}`,
              fontSize: 13,
              color: theme.text,
              fontWeight: 500,
              background: theme.surface,
            }}>
              {config.count} 条
            </div>
          </div>
        </div>

        {/* 底部按钮 */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          paddingTop: 16,
          borderTop: `1px solid ${theme.border}`,
        }}>
          <Button
            onClick={() => setConfig({
              model: 'doubao-seedance-2-0-260128',
              resolution: '720p',
              duration: 5,
              aspectRatio: '9:16',
              count: 1,
              voiceEnabled: true,
            })}
            style={{ borderRadius: 8 }}
          >
            重置默认
          </Button>
          <Button
            type="primary"
            onClick={() => setConfigModalOpen(false)}
            style={{
              background: theme.primary,
              borderColor: theme.primary,
              borderRadius: 8,
            }}
          >
            确定
          </Button>
        </div>
      </Modal>

      {/* 产品选择弹窗 */}
      <Modal
        title="选择产品"
        open={productModalOpen}
        onCancel={() => setProductModalOpen(false)}
        footer={null}
        width={700}
      >
        <div style={{ marginBottom: 16 }}>
          <Input.Search
            placeholder="搜索产品名称或SKU"
            value={productSearch}
            onChange={e => setProductSearch(e.target.value)}
            onSearch={searchProducts}
            onPressEnter={() => searchProducts(productSearch)}
            loading={productLoading}
          />
        </div>
        <Row gutter={[12, 12]}>
          {products.map(p => (
            <Col span={6} key={p.id}>
              <Card
                size="small"
                hoverable
                onClick={() => handleSelectProduct(p)}
                cover={
                  p.image ? (
                    <img src={p.image} style={{ height: 80, objectFit: 'contain' }} alt="" />
                  ) : (
                    <div style={{ height: 80, background: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <AppstoreOutlined style={{ fontSize: 24, color: theme.textTertiary }} />
                    </div>
                  )
                }
              >
                <div style={{ fontSize: 11 }}>
                  <Text ellipsis style={{ fontSize: 11, color: theme.text }}>{p.name}</Text>
                  <br />
                  <Text style={{ color: theme.primary }}>RM {p.sell_price?.toFixed(2) || '0.00'}</Text>
                </div>
              </Card>
            </Col>
          ))}
          {products.length === 0 && (
            <Col span={24}>
              <Empty description="输入关键词搜索产品" />
            </Col>
          )}
        </Row>
      </Modal>
    </div>
  );
}