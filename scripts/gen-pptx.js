const pptxgen = require("pptxgenjs");
const fs = require("fs");

const pptx = new pptxgen();
pptx.layout = "LAYOUT_WIDE"; // 16:9
pptx.author = "博众智汇";
pptx.title = "跨境电商运营实战指南";

// ====== COLOR PALETTE ======
const C = {
  dark: "1F3864",
  blue: "2E75B6",
  light: "CADCFC",
  accent: "ED7D31",
  white: "FFFFFF",
  gray: "B4C6E7",
  darkGray: "666666",
  green: "28A745",
  red: "DC3545",
  bg: "F2F7FC",
};

// ====== SLIDE 1: COVER ======
const slide1 = pptx.addSlide();
slide1.background = { fill: C.dark };
slide1.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: "100%", fill: C.dark });
slide1.addText("跨境电商运营实战指南", { x: 0.8, y: 1.5, w: "80%", fontSize: 44, bold: true, color: C.white, fontFace: "Microsoft YaHei" });
slide1.addText("TikTok Shop · Shopee · Lazada · Amazon", { x: 0.8, y: 2.6, w: "80%", fontSize: 22, color: C.light, fontFace: "Microsoft YaHei" });
slide1.addShape(pptx.ShapeType.rect, { x: 0.8, y: 3.1, w: 3.5, h: 0.05, fill: C.accent });
slide1.addText("从选品到财务 · 从投流到合规 · 全链路知识体系", { x: 0.8, y: 3.4, w: "80%", fontSize: 16, color: C.gray, fontFace: "Microsoft YaHei" });
slide1.addText("博众智汇 · 全域跨境经营管理系统", { x: 0.8, y: 5.2, w: "80%", fontSize: 14, color: C.gray, fontFace: "Microsoft YaHei" });

// ====== SLIDE 2: 目录 ======
const slide2 = pptx.addSlide();
slide2.background = { fill: C.white };
slide2.addText("目  录", { x: 0.6, y: 0.4, fontSize: 32, bold: true, color: C.dark, fontFace: "Microsoft YaHei" });
slide2.addShape(pptx.ShapeType.rect, { x: 0.6, y: 1.0, w: 2, h: 0.04, fill: C.blue });

const tocItems = [
  ["01", "平台与选品", "TikTok/Shopee/Amazon对比 · 选品方法论 · 定价策略"],
  ["02", "财务与ROI", "成本结构 · ROI计算 · 利润模型 · 盈亏平衡"],
  ["03", "TikTok运营", "算法逻辑 · 短视频创作 · 直播带货 · 各市场差异"],
  ["04", "广告投放", "TikTok Ads · 核心指标 · 优化策略 · 预算管理"],
  ["05", "物流与合规", "物流模式 · 供应链管理 · 知识产权 · 风险防控"],
];

tocItems.forEach((item, i) => {
  const y = 1.4 + i * 0.85;
  slide2.addShape(pptx.ShapeType.roundRect, { x: 0.6, y: y, w: 1.5, h: 0.55, fill: C.dark, rectRadius: 0.1 });
  slide2.addText(item[0], { x: 0.6, y: y, w: 1.5, h: 0.55, fontSize: 24, bold: true, color: C.white, align: "center", fontFace: "Microsoft YaHei" });
  slide2.addText(item[1], { x: 2.4, y: y, w: 2.5, fontSize: 18, bold: true, color: C.dark, fontFace: "Microsoft YaHei" });
  slide2.addText(item[2], { x: 2.4, y: y + 0.3, w: 8, fontSize: 13, color: C.darkGray, fontFace: "Microsoft YaHei" });
});

// ====== SLIDE 3: 平台对比 ======
const slide3 = pptx.addSlide();
slide3.background = { fill: C.bg };
slide3.addText("主要跨境电商平台对比", { x: 0.6, y: 0.3, fontSize: 28, bold: true, color: C.dark, fontFace: "Microsoft YaHei" });

const platRows = [
  [{ text: "平台", options: { bold: true, color: C.white, fill: { color: C.dark } } },
   { text: "核心市场", options: { bold: true, color: C.white, fill: { color: C.dark } } },
   { text: "佣金", options: { bold: true, color: C.white, fill: { color: C.dark } } },
   { text: "特点", options: { bold: true, color: C.white, fill: { color: C.dark } } }],
  ["TikTok Shop", "东南亚+英美", "1%-5%", "社交电商 · 内容驱动"],
  ["Shopee", "东南亚+拉美", "2%-5%", "移动端 · 价格敏感"],
  ["Lazada", "东南亚六国", "2%-4%", "品牌商城 · 阿里系"],
  ["Amazon", "全球", "8%-15%", "FBA · 规则严格"],
  ["独立站(Shopify)", "全球", "平台0%", "品牌自主 · 高利润"],
];

slide3.addTable(platRows, {
  x: 0.6, y: 1.0, w: 11.2,
  fontSize: 14, fontFace: "Microsoft YaHei",
  border: { type: "solid", color: C.gray, pt: 0.5 },
  colW: [2.8, 2.6, 2.0, 3.8],
  rowH: [0.5, 0.45, 0.45, 0.45, 0.45, 0.45],
  autoPage: false,
});

// ====== SLIDE 4: 东南亚市场 ======
const slide4 = pptx.addSlide();
slide4.background = { fill: C.white };
slide4.addText("东南亚市场特征", { x: 0.6, y: 0.3, fontSize: 28, bold: true, color: C.dark, fontFace: "Microsoft YaHei" });
slide4.addText("人口 6.8亿 · 互联网渗透 70%+ · 2023电商GMV $1390亿 → 2025预$1860亿", { x: 0.6, y: 0.9, fontSize: 14, color: C.darkGray, fontFace: "Microsoft YaHei" });

const mktCards = [
  { country: "印尼", gmv: "$620亿", pop: "2.7亿", feat: "最大市场 · 穆斯林消费 · COD占40%+" },
  { country: "泰国", gmv: "$220亿", pop: "7000万", feat: "美妆护肤强需求 · 直播活跃" },
  { country: "越南", gmv: "$160亿", pop: "1亿", feat: "人口年轻(均32岁) · 增速最快" },
  { country: "马来", gmv: "$120亿", pop: "3300万", feat: "多语言 · 客单高$8-25" },
  { country: "菲律宾", gmv: "$150亿", pop: "1.1亿", feat: "英语普及 · 社交电商渗透高" },
];

mktCards.forEach((mkt, i) => {
  const x = 0.6 + (i % 3) * 3.9;
  const y = 1.5 + Math.floor(i / 3) * 1.8;
  slide4.addShape(pptx.ShapeType.roundRect, { x, y, w: 3.5, h: 1.5, fill: C.bg, rectRadius: 0.1, line: { color: C.light, width: 0.75 } });
  slide4.addText(mkt.country, { x: x + 0.2, y: y + 0.1, w: 3, fontSize: 18, bold: true, color: C.dark, fontFace: "Microsoft YaHei" });
  slide4.addText(`GMV ${mkt.gmv}  ·  人口 ${mkt.pop}`, { x: x + 0.2, y: y + 0.55, w: 3, fontSize: 12, color: C.blue, fontFace: "Microsoft YaHei" });
  slide4.addText(mkt.feat, { x: x + 0.2, y: y + 0.9, w: 3, fontSize: 12, color: C.darkGray, fontFace: "Microsoft YaHei" });
});

// ====== SLIDE 5: 选品方法 ======
const slide5 = pptx.addSlide();
slide5.background = { fill: C.bg };
slide5.addText("选品方法论", { x: 0.6, y: 0.3, fontSize: 28, bold: true, color: C.dark, fontFace: "Microsoft YaHei" });
slide5.addText("毛利率 ≥ 30% 为基本线  ·  售价 ≥ 采购成本 × 3  ·  体积小/轻/不易碎优先", { x: 0.6, y: 0.9, fontSize: 14, color: C.darkGray, fontFace: "Microsoft YaHei" });

const methods = [
  { title: "数据选品", desc: "TikTok播放量 · 1688热卖品 · Google Trends" },
  { title: "竞品分析", desc: "关键词→高播放视频→评论分析→跟进" },
  { title: "趋势选品", desc: "#TikTokMadeMeBuyIt · 预判趋势周期" },
  { title: "供应链选品", desc: "可定制差异化产品 · 评估供货能力" },
];

methods.forEach((m, i) => {
  const x = 0.6 + i * 3.1;
  slide5.addShape(pptx.ShapeType.roundRect, { x, y: 1.5, w: 2.7, h: 2.0, fill: C.white, rectRadius: 0.1, shadow: { type: "outer", blur: 6, offset: 2, opacity: 0.15 } });
  slide5.addShape(pptx.ShapeType.roundRect, { x: x + 0.9, y: 1.6, w: 0.9, h: 0.5, fill: C.blue, rectRadius: 0.1 });
  slide5.addText(String(i + 1), { x: x + 0.9, y: 1.6, w: 0.9, h: 0.5, fontSize: 22, bold: true, color: C.white, align: "center", fontFace: "Microsoft YaHei" });
  slide5.addText(m.title, { x: x + 0.15, y: 2.3, w: 2.4, fontSize: 18, bold: true, color: C.dark, fontFace: "Microsoft YaHei" });
  slide5.addText(m.desc, { x: x + 0.15, y: 2.8, w: 2.4, fontSize: 12, color: C.darkGray, fontFace: "Microsoft YaHei" });
});

slide5.addText("爆品特征：视觉冲击强 · 解决明确痛点 · $5-30区间 · 30秒能讲清价值 · 有\"哇\"感", { x: 0.6, y: 3.8, w: 11, fontSize: 13, bold: true, color: C.accent, fontFace: "Microsoft YaHei" });

// ====== SLIDE 6: 定价策略 ======
const slide6 = pptx.addSlide();
slide6.background = { fill: C.white };
slide6.addText("定价策略与公式", { x: 0.6, y: 0.3, fontSize: 28, bold: true, color: C.dark, fontFace: "Microsoft YaHei" });

slide6.addShape(pptx.ShapeType.roundRect, { x: 0.6, y: 1.2, w: 5.5, h: 2.5, fill: C.bg, rectRadius: 0.1 });
slide6.addText("核心定价公式", { x: 0.8, y: 1.3, w: 5, fontSize: 16, bold: true, color: C.blue, fontFace: "Microsoft YaHei" });
slide6.addText("售价 = 产品成本 + 利润 + 佣金 + 物流 + 广告 + 退货 + 其他", { x: 0.8, y: 1.7, w: 5, fontSize: 14, color: C.dark, fontFace: "Microsoft YaHei" });
slide6.addText("建议定价倍数", { x: 0.8, y: 2.3, w: 5, fontSize: 14, bold: true, color: C.dark, fontFace: "Microsoft YaHei" });
slide6.addText("东南亚 3-4x  ·  欧美 4-6x  ·  中东 4-8x", { x: 0.8, y: 2.6, w: 5, fontSize: 14, color: C.accent, fontFace: "Microsoft YaHei" });

slide6.addShape(pptx.ShapeType.roundRect, { x: 6.5, y: 1.2, w: 5.5, h: 2.5, fill: C.bg, rectRadius: 0.1 });
slide6.addText("反向推导公式", { x: 6.7, y: 1.3, w: 5, fontSize: 16, bold: true, color: C.blue, fontFace: "Microsoft YaHei" });
slide6.addText("售价 = 总成本 / (1 - 利润率 - 佣金率 - 广告费率 - 退货率)", { x: 6.7, y: 1.7, w: 5, fontSize: 13, color: C.dark, fontFace: "Microsoft YaHei" });
slide6.addText("计算示例", { x: 6.7, y: 2.3, w: 5, fontSize: 14, bold: true, color: C.dark, fontFace: "Microsoft YaHei" });
slide6.addText("总成本¥35 目标利润30% 佣金5% 广告15%\n= 35/0.47 = ¥75", { x: 6.7, y: 2.6, w: 5, fontSize: 13, color: C.accent, fontFace: "Microsoft YaHei" });

slide6.addText("定价策略类型", { x: 0.6, y: 4.0, fontSize: 18, bold: true, color: C.dark, fontFace: "Microsoft YaHei" });
const priceTypes = [
  ["渗透定价", "低价入市抢占份额", "新品冷启动"],
  ["撇脂定价", "高开低走赚早期利润", "差异化产品"],
  ["心理定价", "$19.99代替$20", "降低心理感知"],
  ["捆绑定价", "3件$29 vs 单件$12", "提高客单价"],
];
priceTypes.forEach((p, i) => {
  slide6.addShape(pptx.ShapeType.roundRect, { x: 0.6 + i * 3.1, y: 4.5, w: 2.7, h: 1.3, fill: C.white, rectRadius: 0.08, line: { color: C.light, width: 0.5 } });
  slide6.addText(p[0], { x: 0.8 + i * 3.1, y: 4.55, w: 2.3, fontSize: 16, bold: true, color: C.blue, fontFace: "Microsoft YaHei" });
  slide6.addText(p[1], { x: 0.8 + i * 3.1, y: 4.9, w: 2.3, fontSize: 12, color: C.dark, fontFace: "Microsoft YaHei" });
  slide6.addText(p[2], { x: 0.8 + i * 3.1, y: 5.15, w: 2.3, fontSize: 10, color: C.darkGray, fontFace: "Microsoft YaHei" });
});

// ====== SLIDE 7: 成本结构 ======
const slide7 = pptx.addSlide();
slide7.background = { fill: C.bg };
slide7.addText("成本结构全景图（以售价¥100为例）", { x: 0.6, y: 0.3, fontSize: 28, bold: true, color: C.dark, fontFace: "Microsoft YaHei" });

const costRows = [
  [{ text: "成本项", options: { bold: true, color: C.white, fill: { color: C.dark } } },
   { text: "金额", options: { bold: true, color: C.white, fill: { color: C.dark } } },
   { text: "占比", options: { bold: true, color: C.white, fill: { color: C.dark } } }],
  ["📦 产品成本(采购+包装)", "¥20", "20%"],
  ["🚚 物流成本(头程+尾程+仓储)", "¥15", "15%"],
  ["💰 平台佣金", "¥5", "5%"],
  ["📢 广告营销", "¥15", "15%"],
  ["💳 支付与换汇", "¥3", "3%"],
  ["🔄 退货损耗", "¥3", "3%"],
  ["👥 运营管理(人工+ERP)", "¥5", "5%"],
  ["📋 合规税费", "¥3", "3%"],
  [{ text: "✅ 净利润", options: { bold: true, fill: { color: "E2EFDA" } } },
   { text: "¥31", options: { bold: true, fill: { color: "E2EFDA" } } },
   { text: "31%", options: { bold: true, fill: { color: "E2EFDA" } } }],
];

slide7.addTable(costRows, {
  x: 1.0, y: 1.0, w: 10.4,
  fontSize: 14, fontFace: "Microsoft YaHei",
  border: { type: "solid", color: C.gray, pt: 0.5 },
  colW: [5.4, 2.5, 2.5],
  autoPage: false,
});

// ====== SLIDE 8: ROI 计算 ======
const slide8 = pptx.addSlide();
slide8.background = { fill: C.white };
slide8.addText("ROI 计算与分析", { x: 0.6, y: 0.3, fontSize: 28, bold: true, color: C.dark, fontFace: "Microsoft YaHei" });
slide8.addText("ROI = (收益 - 成本) / 成本 × 100%   |   ROI > 0 盈利 · = 0 持平 · < 0 亏损", { x: 0.6, y: 0.9, fontSize: 14, color: C.darkGray, fontFace: "Microsoft YaHei" });

const roiScenarios = [
  { title: "单品ROI", formula: "(售价-全成本)/全成本×100%", note: "最常用，健康线 > 50%" },
  { title: "广告ROAS", formula: "GMV / 广告花费", note: "> 2可接受 · > 4良好" },
  { title: "达人ROI", formula: "GMV×利润率 / 达人费用", note: "> 2才算有效合作" },
  { title: "直播ROI", formula: "直播GMV / 总直播成本", note: "按场次核算 · 含退货" },
  { title: "店铺ROI", formula: "总利润 / 总投入 ×100%", note: "每月财务结账评估" },
];

roiScenarios.forEach((r, i) => {
  const y = 1.5 + i * 0.82;
  slide8.addShape(pptx.ShapeType.roundRect, { x: 0.6, y, w: 11.2, h: 0.7, fill: i % 2 === 0 ? C.bg : C.white, rectRadius: 0.06, line: { color: C.light, width: 0.3 } });
  slide8.addText(r.title, { x: 0.8, y: y + 0.05, w: 1.6, fontSize: 16, bold: true, color: C.blue, fontFace: "Microsoft YaHei" });
  slide8.addText(r.formula, { x: 2.5, y: y + 0.05, w: 5, fontSize: 14, color: C.dark, fontFace: "Microsoft YaHei" });
  slide8.addText(r.note, { x: 7.5, y: y + 0.05, w: 4, fontSize: 12, color: C.accent, fontFace: "Microsoft YaHei" });
});

slide8.addText("⚠ 常见错误：只看ROAS不看利润 · 没算退货损耗 · 没算汇率损失 · 没算人工成本", { x: 0.6, y: 5.8, fontSize: 14, bold: true, color: C.red, fontFace: "Microsoft YaHei" });

// ====== SLIDE 9: TikTok运营 ======
const slide9 = pptx.addSlide();
slide9.background = { fill: C.bg };
slide9.addText("TikTok Shop 运营核心", { x: 0.6, y: 0.3, fontSize: 28, bold: true, color: C.dark, fontFace: "Microsoft YaHei" });

const tiktokCards = [
  { title: "三种模式", items: ["跨境店：中国直发 5-15天", "本土店：本地仓 1-3天", "全托管：平台负责物流售后"] },
  { title: "算法逻辑", items: ["完播率 > 互动 > 转发 > 关注", "流量池阶梯：100→1k→10k→100万", "黄金前3秒决定推流命运"] },
  { title: "健康指标", items: ["店铺评分 ≥ 4.5", "发货率 ≥ 95%", "退货率 ≤ 10%", "24h响应 ≥ 80%"] },
];

tiktokCards.forEach((c, i) => {
  const x = 0.6 + i * 4.1;
  slide9.addShape(pptx.ShapeType.roundRect, { x, y: 1.2, w: 3.7, h: 3.8, fill: C.white, rectRadius: 0.1, shadow: { type: "outer", blur: 6, offset: 2, opacity: 0.1 } });
  slide9.addShape(pptx.ShapeType.roundRect, { x, y: 1.2, w: 3.7, h: 0.6, fill: C.dark, rectRadius: 0.1 });
  slide9.addText(c.title, { x: x + 0.2, y: 1.25, fontSize: 20, bold: true, color: C.white, fontFace: "Microsoft YaHei" });
  c.items.forEach((item, j) => {
    slide9.addText(`• ${item}`, { x: x + 0.2, y: 2.1 + j * 0.55, w: 3.2, fontSize: 13, color: C.dark, fontFace: "Microsoft YaHei" });
  });
});

slide9.addText("直播排品：福利款(0-10分)→ 利润款(10-30分)→ 爆款(30-45分)→ 引流(45-55分)→ 返场(55-60分)", { x: 0.6, y: 5.3, fontSize: 14, bold: true, color: C.accent, fontFace: "Microsoft YaHei" });

// ====== SLIDE 10: 短视频 + 直播 ======
const slide10 = pptx.addSlide();
slide10.background = { fill: C.white };
slide10.addText("短视频创作 & 直播带货", { x: 0.6, y: 0.3, fontSize: 28, bold: true, color: C.dark, fontFace: "Microsoft YaHei" });

slide10.addShape(pptx.ShapeType.roundRect, { x: 0.6, y: 1.0, w: 5.5, h: 3.8, fill: C.bg, rectRadius: 0.1 });
slide10.addText("爆款视频公式", { x: 0.8, y: 1.1, fontSize: 18, bold: true, color: C.blue, fontFace: "Microsoft YaHei" });
slide10.addText("钩子(3秒)→痛点(5秒)→产品展示(10秒)→效果对比(5秒)→CTA(2秒)", { x: 0.8, y: 1.6, w: 5, fontSize: 13, color: C.dark, fontFace: "Microsoft YaHei" });
slide10.addText("发布策略", { x: 0.8, y: 2.2, fontSize: 16, bold: true, color: C.dark, fontFace: "Microsoft YaHei" });
slide10.addText("• 每日2-3条  时段：12-14点 / 19-22点\n• 用平台热门BGM  标签3-5精准+1-2热门\n• 黄金前3秒！切忌\"大家好今天来...\"", { x: 0.8, y: 2.6, w: 5, fontSize: 13, color: C.dark, fontFace: "Microsoft YaHei" });
slide10.addText("视频类型：展示30% + 教程20% + 开箱15% + 对比15% + 反馈10% + 幕后10%", { x: 0.8, y: 3.4, w: 5, fontSize: 12, color: C.accent, fontFace: "Microsoft YaHei" });

slide10.addShape(pptx.ShapeType.roundRect, { x: 6.5, y: 1.0, w: 5.5, h: 3.8, fill: C.bg, rectRadius: 0.1 });
slide10.addText("直播核心指标", { x: 6.7, y: 1.1, fontSize: 18, bold: true, color: C.blue, fontFace: "Microsoft YaHei" });
slide10.addText("• 场观：直播间总观看人数\n• 在线：实时观看 ≥ 50\n• GPM：千次观看成交额 ≥ 500\n• 转化率：下单/观看 ≥ 2%", { x: 6.7, y: 1.6, w: 5, fontSize: 14, color: C.dark, fontFace: "Microsoft YaHei" });
slide10.addText("提升留存", { x: 6.7, y: 2.7, fontSize: 16, bold: true, color: C.dark, fontFace: "Microsoft YaHei" });
slide10.addText("• 每10分钟一个钩子（抽奖/福利款）\n• 互动提问：扣1/扣2增加参与感\n• 价格悬念+库存紧迫感", { x: 6.7, y: 3.1, w: 5, fontSize: 13, color: C.dark, fontFace: "Microsoft YaHei" });

// ====== SLIDE 11: 广告投放 ======
const slide11 = pptx.addSlide();
slide11.background = { fill: C.bg };
slide11.addText("TikTok Ads 广告投放指南", { x: 0.6, y: 0.3, fontSize: 28, bold: true, color: C.dark, fontFace: "Microsoft YaHei" });

const adRows = [
  [{ text: "广告类型", options: { bold: true, color: C.white, fill: { color: C.dark } } },
   { text: "展示位置", options: { bold: true, color: C.white, fill: { color: C.dark } } },
   { text: "计费", options: { bold: true, color: C.white, fill: { color: C.dark } } },
   { text: "适合场景", options: { bold: true, color: C.white, fill: { color: C.dark } } }],
  ["信息流广告", "For You推荐流", "CPM/CPC/oCPM", "品牌曝光/转化"],
  ["Spark Ads", "加热达人视频", "oCPM", "达人内容放量"],
  ["LIVE Ads", "直播推广位", "CPA/oCPM", "直播间引流"],
  ["TopView", "开屏+首位", "CPM", "大促/品牌日"],
];

slide11.addTable(adRows, {
  x: 0.6, y: 1.0, w: 11.2,
  fontSize: 13, fontFace: "Microsoft YaHei",
  border: { type: "solid", color: C.gray, pt: 0.5 },
  colW: [2.2, 2.8, 2.2, 4.0],
  autoPage: false,
});

slide11.addText("广告优化决策树", { x: 0.6, y: 3.2, fontSize: 18, bold: true, color: C.dark, fontFace: "Microsoft YaHei" });
slide11.addText("✅ ROAS≥4 CVR≥3% → 加预算(≤30%/天)   |   ⚠ ROAS 2-4 → 观察优化   |   ❌ ROAS<1 → 关停重分析", { x: 0.6, y: 3.7, w: 11, fontSize: 14, color: C.dark, fontFace: "Microsoft YaHei" });
slide11.addText("关键提醒：ROAS ≠ 利润！例：$1000广告→$3000 GMV  ROAS=3 但算全成本后利润仅$200！", { x: 0.6, y: 4.2, w: 11, fontSize: 14, bold: true, color: C.red, fontFace: "Microsoft YaHei" });

slide11.addText("预算规划：测试期$30-50/天 → 放量期$100-300/天 → 稳定期$50-150/天", { x: 0.6, y: 5.0, w: 11, fontSize: 14, color: C.accent, fontFace: "Microsoft YaHei" });

// ====== SLIDE 12: 物流与供应链 ======
const slide12 = pptx.addSlide();
slide12.background = { fill: C.white };
slide12.addText("跨境物流与供应链管理", { x: 0.6, y: 0.3, fontSize: 28, bold: true, color: C.dark, fontFace: "Microsoft YaHei" });

const logRows = [
  [{ text: "物流模式", options: { bold: true, color: C.white, fill: { color: C.dark } } },
   { text: "时效", options: { bold: true, color: C.white, fill: { color: C.dark } } },
   { text: "成本", options: { bold: true, color: C.white, fill: { color: C.dark } } },
   { text: "适用场景", options: { bold: true, color: C.white, fill: { color: C.dark } } }],
  ["直邮小包", "7-15天", "低", "测试/小件/低单价"],
  ["专线物流", "5-10天", "中", "稳定订单"],
  ["海外仓", "1-3天", "中高", "爆款·日均≥30单"],
  ["TikTok FBT", "1-3天", "扣点高", "全托管·省心"],
  ["商业快递", "3-7天", "高", "高客单/紧急"],
];

slide12.addTable(logRows, {
  x: 0.6, y: 1.0, w: 11.2,
  fontSize: 14, fontFace: "Microsoft YaHei",
  border: { type: "solid", color: C.gray, pt: 0.5 },
  colW: [2.2, 1.5, 1.8, 5.7],
  autoPage: false,
});

slide12.addText("库存管理核心公式", { x: 0.6, y: 3.3, fontSize: 18, bold: true, color: C.dark, fontFace: "Microsoft YaHei" });
slide12.addText("安全库存 = 日均销量 × 补货周期(天) × 安全系数(1.3~1.5)", { x: 0.6, y: 3.8, w: 11, fontSize: 16, bold: true, color: C.blue, fontFace: "Microsoft YaHei" });
slide12.addText("补货点 = 安全库存 + 日均销量 × 头程天数", { x: 0.6, y: 4.3, w: 11, fontSize: 16, bold: true, color: C.blue, fontFace: "Microsoft YaHei" });

slide12.addText("供应链风控：分散供应商(≥2家) · 合同约束 · 预留10-20%缓冲库存 · 出库质检", { x: 0.6, y: 5.1, w: 11, fontSize: 14, color: C.accent, fontFace: "Microsoft YaHei" });

// ====== SLIDE 13: 合规 ======
const slide13 = pptx.addSlide();
slide13.background = { fill: C.bg };
slide13.addText("合规经营与风险防控", { x: 0.6, y: 0.3, fontSize: 28, bold: true, color: C.dark, fontFace: "Microsoft YaHei" });

slide13.addShape(pptx.ShapeType.roundRect, { x: 0.6, y: 1.1, w: 5.5, h: 2.0, fill: "FFF3CD", rectRadius: 0.08, line: { color: "FFC107", width: 1 } });
slide13.addText("⚠ TikTok Shop 红线", { x: 0.8, y: 1.2, fontSize: 16, bold: true, color: C.red, fontFace: "Microsoft YaHei" });
slide13.addText("❌ 延迟发货 <90% → 限流\n❌ 虚假发货 → 扣分封店\n❌ 引导站外交易 → 永久封禁\n❌ 虚假宣传 → 下架+罚款\n❌ 刷单刷评 → 直接封店", { x: 0.8, y: 1.6, w: 5, fontSize: 13, color: C.dark, fontFace: "Microsoft YaHei" });

slide13.addShape(pptx.ShapeType.roundRect, { x: 6.5, y: 1.1, w: 5.5, h: 2.0, fill: "D4EDDA", rectRadius: 0.08, line: { color: C.green, width: 1 } });
slide13.addText("✅ 合规 CHECKLIST", { x: 6.7, y: 1.2, fontSize: 16, bold: true, color: C.green, fontFace: "Microsoft YaHei" });
slide13.addText("✓ 产品外观无专利冲突\n✓ 品牌名无商标冲突\n✓ 图片素材均为原创/授权\n✓ 达人合作有授权协议\n✓ 各国认证(CERT/SIRIM/CE等)", { x: 6.7, y: 1.6, w: 5, fontSize: 13, color: C.dark, fontFace: "Microsoft YaHei" });

slide13.addText("风险防控矩阵", { x: 0.6, y: 3.5, fontSize: 18, bold: true, color: C.dark, fontFace: "Microsoft YaHei" });
const risks = [
  ["账号封禁", "中", "致命", "多账号矩阵+合规运营"],
  ["资金冻结", "中", "严重", "分散回款+多支付"],
  ["侵权诉讼", "低", "致命", "知识产权全面排查"],
  ["汇率波动", "高", "中等", "多币种账户+锁汇"],
];
risks.forEach((r, i) => {
  slide13.addShape(pptx.ShapeType.roundRect, { x: 0.6 + i * 3.1, y: 4.1, w: 2.7, h: 1.5, fill: C.white, rectRadius: 0.08, shadow: { type: "outer", blur: 4, offset: 1, opacity: 0.1 } });
  slide13.addText(r[0], { x: 0.8 + i * 3.1, y: 4.15, fontSize: 15, bold: true, color: C.dark, fontFace: "Microsoft YaHei" });
  slide13.addText(`概率${r[1]} | 危害${r[2]}`, { x: 0.8 + i * 3.1, y: 4.5, fontSize: 11, color: C.darkGray, fontFace: "Microsoft YaHei" });
  slide13.addText(r[3], { x: 0.8 + i * 3.1, y: 4.8, fontSize: 12, color: C.blue, fontFace: "Microsoft YaHei" });
});

// ====== SLIDE 14: 工具 ======
const slide14 = pptx.addSlide();
slide14.background = { fill: C.white };
slide14.addText("常用工具清单 & 成功案例", { x: 0.6, y: 0.3, fontSize: 28, bold: true, color: C.dark, fontFace: "Microsoft YaHei" });

const toolRows = [
  [{ text: "分类", options: { bold: true, color: C.white, fill: { color: C.dark } } },
   { text: "推荐工具", options: { bold: true, color: C.white, fill: { color: C.dark } } },
   { text: "用途", options: { bold: true, color: C.white, fill: { color: C.dark } } }],
  ["ERP管理", "店小秘/马帮ERP", "多平台订单库存管理"],
  ["TikTok分析", "Kalodata/Tabcut/Tikstar", "达人/商品/直播/竞品分析"],
  ["选品工具", "1688/知虾/Jungle Scout", "热卖品搜索/供应商查找"],
  ["内容创作", "CapCut(剪映)/Canva", "视频剪辑/图片设计"],
  ["AI辅助", "ChatGPT/DeepSeek", "文案写作/脚本生成/分析"],
  ["跨境收款", "Payoneer/PingPong", "收款/换汇/多币种"],
];

slide14.addTable(toolRows, {
  x: 0.6, y: 0.9, w: 11.2,
  fontSize: 13, fontFace: "Microsoft YaHei",
  border: { type: "solid", color: C.gray, pt: 0.5 },
  colW: [2.2, 4.0, 5.0],
  autoPage: false,
});

slide14.addText("成功案例", { x: 0.6, y: 3.8, fontSize: 18, bold: true, color: C.dark, fontFace: "Microsoft YaHei" });
slide14.addText("🇮🇩 印尼3C配件月销$30万：本土仓+50+达人(纯佣)+日更3-5条短视频+日播4小时", { x: 0.6, y: 4.3, w: 11, fontSize: 14, color: C.blue, fontFace: "Microsoft YaHei" });
slide14.addText("🇹🇭 美妆泰国冷启动：$5000启动→达人测评+Spark Ads→3个月GMV $0→$8万", { x: 0.6, y: 4.8, w: 11, fontSize: 14, color: C.blue, fontFace: "Microsoft YaHei" });

// ====== SLIDE 15: 避坑 ======
const slide15 = pptx.addSlide();
slide15.background = { fill: C.dark };
slide15.addText("新手10大常见错误", { x: 0.6, y: 0.4, fontSize: 28, bold: true, color: C.white, fontFace: "Microsoft YaHei" });

const mistakes = [
  "上来就铺大货不测试 → 先单品测试验证",
  "不算隐性成本就定价 → 全链路成本核算",
  "广告预算失控 → 设每日预算上限",
  "忽略退货损耗 → 定价必须计入",
  "素材从不更新 → 每周至少更新1次",
  "频繁调广告 → 给24-48h学习期",
  "贪多求全 → 先深耕1-2个市场",
  "完全模仿竞品 → 差异化才有竞争力",
  "不做数据复盘 → 每天花30分钟看数据",
  "单纯低价竞争 → 价格战不可持续",
];

mistakes.forEach((m, i) => {
  const x = 0.6 + (i % 2) * 6.2;
  const y = 1.2 + Math.floor(i / 2) * 0.9;
  slide15.addShape(pptx.ShapeType.roundRect, { x, y, w: 5.8, h: 0.7, fill: "2E4372", rectRadius: 0.06 });
  slide15.addText(`${i + 1}. ${m}`, { x: x + 0.2, y: y + 0.05, w: 5.4, fontSize: 15, color: C.white, fontFace: "Microsoft YaHei" });
});

// ====== SLIDE 16: END ======
const slide16 = pptx.addSlide();
slide16.background = { fill: C.dark };
slide16.addText("Thank You", { x: 0, y: 2.0, w: "100%", fontSize: 52, bold: true, color: C.white, align: "center", fontFace: "Microsoft YaHei" });
slide16.addText("数据驱动决策 · 内容建立壁垒 · 合规守住底线", { x: 0, y: 3.2, w: "100%", fontSize: 20, color: C.light, align: "center", fontFace: "Microsoft YaHei" });
slide16.addShape(pptx.ShapeType.rect, { x: 3.5, y: 3.9, w: 6, h: 0.03, fill: C.accent });
slide16.addText("博众智汇 · 全域跨境经营管理系统\nwww.bozone.cn", { x: 0, y: 4.3, w: "100%", fontSize: 14, color: C.gray, align: "center", fontFace: "Microsoft YaHei" });

// ====== SAVE ======
const pptxPath = "f:/tiktok-crm/docs/knowledge-base/跨境电商运营实战指南.pptx";
pptx.writeFile({ fileName: pptxPath }).then(() => {
  console.log("PPTX created:", pptxPath);
}).catch(err => { console.error(err); process.exit(1); });
