const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType,
  LevelFormat, PageBreak, Header, Footer, PageNumber, TableOfContents
} = require("docx");

const LQ = "\u201C"; // left Chinese curly double quote
const RQ = "\u201D"; // right Chinese curly double quote
const LQ2 = "\u300C"; // left CJK corner bracket
const RQ2 = "\u300D"; // right CJK corner bracket
const Q = function(s) { return LQ + s + RQ; };
const Q2 = function(s) { return LQ2 + s + RQ2; };

const C = {
  blue: "2563EB", darkBlue: "1E3A5F", gray: "F5F6FA", lightGray: "F0F2F5",
  white: "FFFFFF", border: "D0D5DD", text: "1D2939", textGray: "667085",
  orange: "F97316", green: "059669", red: "DC2626", headerBg: "1E3A5F",
};

const bdr = { style: BorderStyle.SINGLE, size: 1, color: C.border };
const borders = { top: bdr, bottom: bdr, left: bdr, right: bdr };
const cellM = { top: 60, bottom: 60, left: 100, right: 100 };

function H(level, text) {
  return new Paragraph({ heading: level, children: [new TextRun({ text, font: "Arial" })] });
}

function P(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text, font: "Arial", size: opts.size || 22, color: opts.color || C.text, bold: !!opts.bold, italics: !!opts.italics })],
  });
}

function N(text) {
  return new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text, font: "Arial", size: 20, color: C.textGray, italics: true })] });
}

function SP(pts) { return new Paragraph({ spacing: { after: pts || 120 }, children: [] }); }

function DIV() {
  return new Paragraph({ spacing: { before: 80, after: 80 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: C.border, space: 1 } }, children: [] });
}

function BL(text) {
  return new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 60 }, children: [new TextRun({ text, font: "Arial", size: 22, color: C.text })] });
}

function HL(text) {
  return new Paragraph({
    spacing: { before: 120, after: 120 }, indent: { left: 200, right: 200 },
    shading: { type: ShadingType.CLEAR, fill: "FFF4E5" },
    border: { left: { style: BorderStyle.SINGLE, size: 24, color: C.orange, space: 8 } },
    children: [new TextRun({ text, font: "Arial", size: 22, color: "92400E" })],
  });
}

function MT(headers, rows, colW) {
  const tw = colW.reduce((a, b) => a + b, 0);
  const hr = new TableRow({ tableHeader: true, children: headers.map((h, i) =>
    new TableCell({ borders, width: { size: colW[i], type: WidthType.DXA }, shading: { fill: C.headerBg, type: ShadingType.CLEAR }, margins: cellM, verticalAlign: "center",
      children: [new Paragraph({ children: [new TextRun({ text: h, font: "Arial", size: 20, bold: true, color: "FFFFFF" })] })] })) });
  const dr = rows.map((row, ri) =>
    new TableRow({ children: row.map((cell, ci) =>
      new TableCell({ borders, width: { size: colW[ci], type: WidthType.DXA }, shading: { fill: ri % 2 === 0 ? C.white : C.gray, type: ShadingType.CLEAR }, margins: cellM, verticalAlign: "center",
        children: [new Paragraph({ children: [new TextRun({ text: String(cell), font: "Arial", size: 20, color: C.text })] })] })) }));
  return new Table({ width: { size: tw, type: WidthType.DXA }, columnWidths: colW, rows: [hr, ...dr] });
}

function KT(label, items) {
  return [P(label, { bold: true }), MT(["维度", "详情"], items.map(([k, v]) => [k, v]), [1600, 7760]), SP(80)];
}

const ch = [];
const PW = 12240;
const MAR = 1440;

// ── Cover Page ──
ch.push(SP(600));
ch.push(new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: "TikTok 跨境电商 ERP", font: "Arial", size: 56, bold: true, color: C.darkBlue })] }));
ch.push(new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: "市场竞品分析报告", font: "Arial", size: 56, bold: true, color: C.blue })] }));
ch.push(DIV());
ch.push(SP(300));
ch.push(P("调研时间：2026年5月", { size: 24, color: C.textGray }));
ch.push(P("调研范围：市面主流 TikTok Shop 跨境电商 ERP 系统共 13 款", { size: 24, color: C.textGray }));
ch.push(P("分析维度：市场定位 · 功能覆盖 · UI设计风格 · 定价策略", { size: 24, color: C.textGray }));
ch.push(SP(400));
ch.push(new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: "报告摘要", font: "Arial", size: 28, bold: true, color: C.darkBlue })] }));
ch.push(P("本报告对2026年市面上13款主流TikTok Shop跨境电商ERP系统进行了全面调研分析。研究发现：市场呈现" + Q("一超多强") + "格局，店小秘以180万+用户领跑；93%的产品采用蓝色系UI，视觉同质化严重；所有竞品均无AI视频生成和达人BD管理能力——而这两项恰好是本系统的核心优势。报告最终提出了以TikTok为第一优先级、融合内容运营与进销存管理的新一代ERP产品架构建议。", { size: 22, color: C.text }));
ch.push(new PageBreak());

// ── TOC ──
ch.push(H(HeadingLevel.HEADING_1, "目录"));
ch.push(new TableOfContents("目录", { hyperlink: true, headingStyleRange: "1-3" }));
ch.push(new PageBreak());

// ── Section 1 ──
ch.push(H(HeadingLevel.HEADING_1, "一、市场格局总览"));
ch.push(P("截至2026年，TikTok Shop 跨境电商 ERP 市场呈现" + Q("一超多强") + "格局："));
ch.push(SP(80));
ch.push(MT(
  ["层级", "代表产品", "核心特征"],
  [
    ["头号玩家", "店小秘（180万+用户）", "全平台覆盖，免费版引流，生态最完整"],
    ["一线阵营", "领星、赛狐、易仓、马帮", "各有专长（Amazon/TikTok/供应链/多平台）"],
    ["区域/垂直", "BigSeller、妙手、芒果店长、通途", "东南亚深耕或免费模式"],
    ["新兴力量", "斑马、积加、数字酋长、客优云", "细分功能切入"],
  ],
  [2200, 3400, 3760]
));
ch.push(SP(160));
ch.push(HL("关键发现：目前市面上没有一款真正的" + Q("TikTok Shop 原生专用 ERP") + "——所有产品都是先支持 Amazon/Shopee 再拓展到 TikTok。这意味着如果你打造一款以 TikTok 为第一优先级的 ERP，存在显著的空白市场机会。"));
ch.push(new PageBreak());

// ── Section 2 ──
ch.push(H(HeadingLevel.HEADING_1, "二、主力竞品逐项分析"));

// 2.1 店小秘
ch.push(H(HeadingLevel.HEADING_2, "2.1 店小秘 (Dianxiaomi) - 市占率第一"));
ch.push(P("基本信息", { bold: true }));
ch.push(MT(["维度", "详情"], [
  ["定位", "全能型一站式 SaaS，从个人到中大型均覆盖"],
  ["核心数据", "180万+用户 · 70+平台 · 1700+物流商 · 日处理1100万+订单"],
  ["功能模块", "产品刊登、订单处理、库存管理、客服、采购、仓库、物流、财务、员工权限"],
  ["定价", "免费版 + 付费版（面向中大型）"],
], [1600, 7760]));
ch.push(SP(80));
ch.push(P("UI 设计风格", { bold: true }));
ch.push(MT(["维度", "详情"], [
  ["主色调", "科技蓝 + 白 + 橙色CTA"],
  ["布局", "左侧深蓝导航 + 顶部通栏 + 右侧内容区（经典SaaS布局）"],
  ["视觉特征", "卡片式功能模块、大数字背书、扁平图标、多色彩标签区分状态"],
  ["整体气质", "务实工具型，功能密度高，信息量大，偏" + Q("操作台") + "风格"],
  ["子品牌 BigSeller", "专门面向东南亚，橙/红色系为主，更年轻活泼"],
], [1600, 7760]));
ch.push(SP(160));

// 2.2 领星
ch.push(H(HeadingLevel.HEADING_2, "2.2 领星 (Lingxing) - Amazon 精细化标杆"));
ch.push(P("基本信息", { bold: true }));
ch.push(MT(["维度", "详情"], [
  ["定位", "跨境全平台精细化管理服务商（Amazon为核心）"],
  ["核心数据", "70万+企业 · 40+平台 · 市占率中国第一（艾瑞认证）"],
  ["核心优势", "利润核算极强、广告分析、FBA库存管理、财务合规"],
  ["定价", "付费制（按功能/规模）"],
], [1600, 7760]));
ch.push(SP(80));
ch.push(P("UI 设计风格", { bold: true }));
ch.push(MT(["维度", "详情"], [
  ["主色调", "深蓝（#1a3a5c 系）+ 白 + 橙色CTA"],
  ["布局", "数据可视化优先，BI自定义仪表盘是核心卖点"],
  ["视觉特征", "大量图表组件、利润瀑布流、业务驾驶舱、深色卡片+浅色背景"],
  ["整体气质", "数据驱动型，专业严肃，适合精细化运营团队，重视" + Q("报表") + "呈现"],
  ["行业备注", "曾起诉赛狐、店小秘" + Q("UI抄袭") + "，说明其UI设计被视为标杆"],
], [1600, 7760]));
ch.push(SP(160));

// 2.3 赛狐
ch.push(H(HeadingLevel.HEADING_2, "2.3 赛狐 (SellFox) - Amazon SPN 认证"));
ch.push(P("基本信息", { bold: true }));
ch.push(MT(["维度", "详情"], [
  ["定位", "中大型卖家优选，亚马逊+Temu+TikTok+沃尔玛"],
  ["核心数据", "50万+卖家 · 28+平台 · 自称" + Q("用户增速第一")],
  ["核心优势", "财务利润核算（分钟级同步）、广告智能优化、供应链精细管理"],
  ["定价", "付费制"],
], [1600, 7760]));
ch.push(SP(80));
ch.push(P("UI 设计风格", { bold: true }));
ch.push(MT(["维度", "详情"], [
  ["主色调", "深蓝 + 亮橙 + 白"],
  ["布局", "痛点-解决方案式展示，功能卡片网格，平台切换Tab"],
  ["视觉特征", "大数字动画、图标矩阵、" + Q("极简操作界面") + "是官方宣传点"],
  ["整体气质", "专业商务风，UI被指与领星高度相似（曾败诉不正当竞争）"],
], [1600, 7760]));
ch.push(SP(160));

// 2.4 易仓
ch.push(H(HeadingLevel.HEADING_2, "2.4 易仓 (ECCANG) - 跨境物流生态型"));
ch.push(P("基本信息", { bold: true }));
ch.push(MT(["维度", "详情"], [
  ["定位", "中大型跨境卖家/品牌企业/工贸一体"],
  ["核心数据", "30000+成长型卖家 · 60+平台 · 1000+物流商"],
  ["核心优势", "物流轨迹实时追踪、关税自动计算、多币种财务、生态协同"],
  ["定价", "付费制（偏高）"],
], [1600, 7760]));
ch.push(SP(80));
ch.push(P("UI 设计风格", { bold: true }));
ch.push(MT(["维度", "详情"], [
  ["主色调", "科技蓝 + 深灰 + 白"],
  ["布局", "左导航+顶部数据看板+右侧内容，订单列表模块突出"],
  ["视觉特征", "物流追踪可视化、大效率数字（60%、1200+件/h）、客户案例轮播"],
  ["整体气质", "工业感强，功能密集，偏" + Q("操作效率") + "风格"],
], [1600, 7760]));
ch.push(SP(160));

// 2.5 马帮
ch.push(H(HeadingLevel.HEADING_2, "2.5 马帮 (Mabang) - 多平台老牌"));
ch.push(P("基本信息", { bold: true }));
ch.push(MT(["维度", "详情"], [
  ["定位", "全链路多平台运营，深耕15年"],
  ["核心数据", "20万+企业 · 60+平台"],
  ["核心优势", "采购-仓储-订单-物流-客服-财务-供应链全流程覆盖"],
  ["定价", "付费制"],
], [1600, 7760]));
ch.push(SP(80));
ch.push(P("UI 设计风格", { bold: true }));
ch.push(MT(["维度", "详情"], [
  ["主色调", "品牌蓝 + 橙黄CTA + 浅灰背景"],
  ["布局", "模块化分区色块，大标题+图标+客户案例"],
  ["视觉特征", "扁平化线性图标、大号数字、蓝橙对比贯穿"],
  ["整体气质", "稳重实用型，功能性压倒设计感"],
], [1600, 7760]));
ch.push(SP(160));

// 2.6 妙手
ch.push(H(HeadingLevel.HEADING_2, "2.6 妙手 (Miaoshou) - 新兴 TikTok 友好型"));
ch.push(P("基本信息", { bold: true }));
ch.push(MT(["维度", "详情"], [
  ["定位", "110万+用户，TikTok/Shopee/Temu/Ozon/美客多为主"],
  ["核心优势", "采集、刊登、选品、定价、订单、仓储、物流、代打包、财务一体化"],
  ["定价", "免费为主"],
], [1600, 7760]));
ch.push(SP(80));
ch.push(P("UI 设计风格", { bold: true }));
ch.push(MT(["维度", "详情"], [
  ["主色调", "绿色/蓝色 + 白"],
  ["布局", "简洁轻量，功能模块清晰"],
  ["整体气质", "轻量友好型，学习成本低"],
], [1600, 7760]));
ch.push(SP(160));

// 2.7 BigSeller
ch.push(H(HeadingLevel.HEADING_2, "2.7 BigSeller - 东南亚专属（店小秘子品牌）"));
ch.push(P("基本信息", { bold: true }));
ch.push(MT(["维度", "详情"], [
  ["定位", "专注东南亚市场，Shopee/Lazada/TikTok Shop"],
  ["核心数据", "16+平台"],
  ["核心优势", "产品刊登、订单处理、库存管理、采购建议、数据分析、财务"],
  ["定价", "免费"],
], [1600, 7760]));
ch.push(SP(80));
ch.push(P("UI 设计风格", { bold: true }));
ch.push(MT(["维度", "详情"], [
  ["主色调", "橙/红色系 + 白（与店小秘蓝形成差异化）"],
  ["布局", "简洁操作面板，流程引导式设计"],
  ["视觉特征", "活力暖色系，年轻化，东南亚风格"],
  ["整体气质", "轻快活泼，上手快"],
], [1600, 7760]));
ch.push(SP(160));

// 2.8 其他竞品速览
ch.push(H(HeadingLevel.HEADING_2, "2.8 其他竞品速览"));
ch.push(SP(80));
ch.push(MT(
  ["产品", "主色调", "定位", "特色"],
  [
    ["芒果店长", "蓝/绿 + 白", "东南亚免费ERP", "早期SaaS先驱，Shopee为主"],
    ["通途", "蓝 + 白", "老牌跨境ERP", "分ERP+Listing两套系统"],
    ["斑马", "蓝 + 白", "免费跨境ERP", "深度对接日本乐天、雅虎"],
    ["积加", "蓝 + 白", "Amazon/TikTok", "物流仓库管理见长"],
    ["旺店通", "蓝 + 白", "中大型全渠道", "仓储WMS强项"],
    ["数字酋长", "蓝 + 白", "TikTok新秀", "利润精算+BI+AI分析"],
  ],
  [1600, 1600, 2600, 3560]
));
ch.push(new PageBreak());

// ── Section 3 ──
ch.push(H(HeadingLevel.HEADING_1, "三、UI 设计风格横向对比"));

ch.push(H(HeadingLevel.HEADING_2, "3.1 色彩体系分析"));
ch.push(P("对全部13款产品的色彩进行统计分析："));
ch.push(SP(60));
ch.push(MT(
  ["色系", "产品清单", "占比"],
  [
    ["蓝色系", "店小秘、领星、赛狐、易仓、马帮、通途、斑马、积加、旺店通、数字酋长、客优云、芒果店长", "93%（12/13）"],
    ["橙/红色系", "BigSeller（东南亚专属）", "7%（1/13）"],
    ["绿色系", "妙手（偏绿）", "7%（部分）"],
  ],
  [1400, 5960, 2000]
));
ch.push(SP(120));
ch.push(HL("关键发现：93% 的产品用蓝色系，视觉同质化极其严重。一套差异化的配色方案是明显的突围机会。本系统现有的" + Q("暖灰商务风") + "已经具备了差异化基因。"));
ch.push(SP(120));

ch.push(H(HeadingLevel.HEADING_2, "3.2 布局模式对比"));
ch.push(MT(
  ["布局模式", "使用产品", "占比"],
  [
    ["左侧深蓝导航 + 右侧内容区", "店小秘、领星、赛狐、易仓、马帮", "85%"],
    ["顶部导航 + 卡片内容", "妙手、BigSeller、芒果店长", "15%"],
    ["支持暗色模式", "无（未发现任何一款支持）", "0%"],
  ],
  [3600, 4000, 1760]
));
ch.push(SP(160));

ch.push(H(HeadingLevel.HEADING_2, "3.3 视觉特征总结"));
ch.push(MT(
  ["特征", "主流做法"],
  [
    ["导航风格", "深色侧边栏（深蓝/深灰），展开式多级菜单"],
    ["内容区背景", "浅灰 #F5F6FA ~ #F0F2F5"],
    ["卡片样式", "白底+圆角(6-12px)+微阴影，模块化"],
    ["图标系统", "线性/扁平化图标，统一色系"],
    ["数据展示", "大号数字+迷你图表（仪表盘页），表格为主（列表页）"],
    ["CTA按钮", "橙/亮色突出，与主蓝形成对比"],
    ["状态标签", "多彩圆点/标签区分（绿=成功、红=异常、黄=待处理）"],
    ["字体", "中文系统默认（无定制字体）"],
    ["动效", "极少（仅数据数字跳动）"],
  ],
  [2200, 7160]
));
ch.push(new PageBreak());

// ── Section 4 ──
ch.push(H(HeadingLevel.HEADING_1, "四、功能覆盖矩阵"));
ch.push(N("下表对比主流竞品与本系统的功能完整性 (Y=支持, P=部分支持, N=不支持, 空=未确认)"));
ch.push(SP(80));
ch.push(MT(
  ["功能模块", "店小秘", "领星", "赛狐", "易仓", "马帮", "妙手", "BigSeller", "本系统"],
  [
    ["多店铺管理", "Y", "Y", "Y", "Y", "Y", "Y", "Y", "Y"],
    ["订单处理", "Y", "Y", "Y", "Y", "Y", "Y", "Y", "Y"],
    ["产品刊登", "Y", "Y", "Y", "Y", "Y", "Y", "Y", "N"],
    ["库存/进销存", "Y", "Y", "Y", "Y", "Y", "Y", "Y", "N"],
    ["采购管理", "Y", "Y", "Y", "Y", "Y", "Y", "Y", "N"],
    ["仓储WMS", "Y", "N", "P", "Y", "Y", "Y", "Y", "N"],
    ["物流对接", "Y", "P", "P", "Y", "Y", "Y", "Y", "N"],
    ["财务/利润核算", "Y", "Y", "Y", "Y", "Y", "Y", "Y", "Y"],
    ["广告管理", "N", "Y", "Y", "N", "N", "N", "N", "N"],
    ["AI视频生成", "N", "N", "N", "N", "N", "N", "N", "Y *"],
    ["达人BD/CRM", "N", "N", "N", "N", "N", "N", "N", "Y *"],
    ["数据分析BI", "P", "Y", "Y", "P", "P", "Y", "Y", "P"],
    ["多货币/汇率", "Y", "Y", "Y", "Y", "Y", "Y", "Y", "Y"],
    ["员工权限", "Y", "Y", "Y", "Y", "Y", "N", "N", "Y"],
    ["移动端APP", "Y", "Y", "Y", "Y", "N", "N", "N", "N"],
    ["开放式API", "Y", "N", "N", "Y", "N", "N", "N", "N"],
    ["素材库管理", "N", "N", "N", "N", "N", "N", "N", "Y *"],
  ],
  [1800, 760, 760, 760, 760, 760, 760, 900, 900]
));
ch.push(SP(120));
ch.push(N("* = 本系统独有优势功能"));
ch.push(new PageBreak());

// ── Section 5 ──
ch.push(H(HeadingLevel.HEADING_1, "五、关键机会点分析"));

ch.push(H(HeadingLevel.HEADING_2, "5.1 本系统差异化优势"));
ch.push(MT(
  ["能力", "本系统", "市面竞品", "竞争地位"],
  [
    ["AI视频生成（Seedance 2.0）", "Y", "N 全无", "独家"],
    ["达人BD/CRM管理", "Y", "N 全无", "独家"],
    ["素材库管理", "Y", "N 全无", "独家"],
    ["利润核算（多成本项）", "Y", "Y 有（非TikTok专属）", "持平"],
  ],
  [3000, 1200, 2200, 2960]
));
ch.push(SP(120));
ch.push(P("本系统天然绑定了 TikTok 生态的核心诉求（内容+达人+素材），这正是市面上所有 ERP 的盲区。"));

ch.push(H(HeadingLevel.HEADING_2, "5.2 可突围的方向"));
ch.push(BL("UI视觉差异化：全行业蓝色同质化 -> 本系统" + Q("暖灰商务") + "风已具备差异化基础，可强化为品牌识别"));
ch.push(BL("TikTok 原生优先：从 TikTok Shop API 深度对接出发，而非" + Q("Amazon插件移植")));
ch.push(BL("内容运营 + 进销存一体化：把AI视频、素材管理、达人BD融入 ERP 主流程"));
ch.push(BL("暗色模式：全行业0%支持，率先推出可成卖点"));
ch.push(BL("移动端：达人/素材/审批等场景天然适合移动端"));
ch.push(SP(160));

ch.push(H(HeadingLevel.HEADING_2, "5.3 与竞品的核心差异定位"));
ch.push(MT(
  ["维度", "传统ERP（店小秘/领星等）", "本系统定位"],
  [
    ["设计哲学", "交易效率优先（订单-库存-物流）", "内容效率优先（视频-达人-素材）+ 交易效率"],
    ["目标用户", "Amazon/Shopee 卖家为主", "TikTok Shop 原生卖家"],
    ["核心场景", "订单处理、进销存、刊登", "内容创作 -> 达人合作 -> 订单转化 -> 利润核算"],
    ["AI能力", "无/简单数据分析", "AI视频生成 + AI数据分析"],
    ["视觉风格", "蓝色系同质化", "暖灰商务风（差异化识别）"],
  ],
  [2200, 3580, 3580]
));
ch.push(new PageBreak());

// ── Section 6 ──
ch.push(H(HeadingLevel.HEADING_1, "六、建议产品功能架构"));
ch.push(P("基于市场调研和本系统现有优势，建议商用版 TikTok 跨境 ERP 包含以下功能模块："));
ch.push(SP(100));
ch.push(MT(
  ["层级", "模块", "核心功能"],
  [
    ["核心层", "店铺管理", "多店铺授权、多平台接入、订单自动同步、消息中心"],
    ["核心层", "商品管理", "产品刊登/采集、SKU管理、进销存、库存预警"],
    ["核心层", "订单处理", "订单审核、智能分仓、批量发货、售后管理"],
    ["扩展层", "广告管理", "投放管理、素材管理、ROI分析、广告报表"],
    ["扩展层", "达人BD", "达人CRM、合作记录、日报/周报、绩效分析"],
    ["扩展层", "AI内容", "AI视频生成（Seedance）、素材库、智能剪辑"],
    ["支撑层", "仓储WMS", "入库/出库、库存盘点、波次拣货、多仓协同"],
    ["支撑层", "物流管理", "多渠道物流对接、轨迹追踪、运费计算、异常预警"],
    ["支撑层", "财务管理", "利润精算、多币种汇率、成本归集、财务报表"],
    ["基础层", "数据分析", "BI仪表盘、利润趋势图、Top10热销、同期群分析"],
    ["基础层", "权限管理", "角色权限、员工管理、审计日志、操作日志"],
    ["基础层", "系统设置", "多语言、多时区、API开放平台、移动端"],
  ],
  [1400, 1600, 6360]
));
ch.push(SP(160));
ch.push(HL("核心策略：以 TikTok 内容电商为第一优先级，用 AI视频生成 + 达人CRM + 素材管理构建竞争壁垒，再逐步补齐全链路进销存能力。"));
ch.push(new PageBreak());

// ── Section 7 ──
ch.push(H(HeadingLevel.HEADING_1, "七、总结与行动建议"));
ch.push(SP(80));

ch.push(H(HeadingLevel.HEADING_2, "7.1 市场洞察"));
ch.push(BL("TikTok Shop 跨境 ERP 市场规模快速增长，但现有产品均为 Amazon/Shopee 的" + Q("副产物") + "，缺乏原生 TikTok 基因"));
ch.push(BL("所有竞品均无 AI视频生成、达人BD、素材管理能力——这三个正是 TikTok 卖家的核心刚需"));
ch.push(BL("93% 产品使用蓝色系 UI，视觉高度同质化，存在巨大的品牌识别机会"));
ch.push(BL("暗色模式、移动端适配、API开放生态 均为市场空白"));

ch.push(H(HeadingLevel.HEADING_2, "7.2 推荐行动路线"));
ch.push(MT(
  ["阶段", "时间", "核心任务"],
  [
    ["Phase 1 品牌重塑", "1-2个月", "确定新品牌命名 · 设计差异化UI体系（暖灰商务进化版）· 输出品牌规范"],
    ["Phase 2 核心闭环", "2-4个月", "店铺管理+订单处理+利润核算 核心交易闭环 · TikTok Shop API深度对接"],
    ["Phase 3 内容壁垒", "1-2个月", "AI视频生成+素材库+达人CRM 融入主导航 · 构建内容电商差异化壁垒"],
    ["Phase 4 供应链", "2-3个月", "商品刊登+进销存+采购管理+仓储WMS基础版"],
    ["Phase 5 生态化", "持续迭代", "物流对接+广告管理+移动端+API开放平台 · 形成完整生态"],
  ],
  [1800, 1400, 6160]
));

ch.push(SP(200));
ch.push(DIV());
ch.push(SP(100));
ch.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [new TextRun({ text: "— 报告完 —", font: "Arial", size: 22, color: C.textGray, italics: true })] }));
ch.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: "生成时间：2026年5月28日", font: "Arial", size: 20, color: C.textGray })] }));
ch.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "基于 虾掌柜ERP 现有系统分析 | 数据来源：各品牌官网公开信息", font: "Arial", size: 20, color: C.textGray })] }));

// ── Assemble ──
const doc = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, font: "Arial", color: C.darkBlue },
        paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: "Arial", color: C.blue },
        paragraph: { spacing: { before: 240, after: 160 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, font: "Arial", color: C.text },
        paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 2 } },
    ],
  },
  numbering: {
    config: [{ reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u25CF", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] }],
  },
  sections: [{
    properties: {
      page: { size: { width: PW, height: 15840 }, margin: { top: 1200, right: MAR, bottom: 1200, left: MAR } },
    },
    headers: {
      default: new Header({ children: [
        new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: C.border, space: 4 } }, spacing: { after: 80 },
          children: [
            new TextRun({ text: "TikTok 跨境电商 ERP 竞品分析报告", font: "Arial", size: 18, color: C.textGray }),
            new TextRun({ text: "    |    机密文件", font: "Arial", size: 18, color: C.red }),
          ] }) ] }),
    },
    footers: {
      default: new Footer({ children: [
        new Paragraph({ alignment: AlignmentType.CENTER, border: { top: { style: BorderStyle.SINGLE, size: 4, color: C.border, space: 4 } },
          children: [
            new TextRun({ text: "第 ", font: "Arial", size: 18, color: C.textGray }),
            new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 18, color: C.textGray }),
            new TextRun({ text: " 页", font: "Arial", size: 18, color: C.textGray }),
          ] }) ] }),
    },
    children: ch,
  }],
});

const outPath = "f:/tiktok-crm/docs/TikTok_ERP_竞品分析报告_20260528.docx";
const outDir = require("path").dirname(outPath);
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(outPath, buffer);
  console.log("OK: " + outPath);
}).catch((err) => {
  console.error("FAIL:", err);
});
