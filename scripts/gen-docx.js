const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        Header, Footer, AlignmentType, LevelFormat,
        HeadingLevel, BorderStyle, WidthType, ShadingType,
        PageNumber, PageBreak, TabStopType, TabStopPosition } = require('docx');

// Color palette
const BLUE = "2E75B6";
const DARK = "1F3864";
const LIGHT_BG = "F2F7FC";
const BORDER_COLOR = "B4C6E7";
const ACCENT = "ED7D31";

// Reusable border
const cellBorder = { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR };
const cellBorders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };
const headerBorder = { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR };

function headerRow(texts, widths, bg = DARK) {
  return new TableRow({
    children: texts.map((t, i) => new TableCell({
      borders: cellBorders,
      width: { size: widths[i], type: WidthType.DXA },
      shading: { fill: bg, type: ShadingType.CLEAR },
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: t, bold: true, color: "FFFFFF", font: "Microsoft YaHei", size: 20 })] })],
    }))
  });
}

function dataRow(texts, widths, bg = "") {
  return new TableRow({
    children: texts.map((t, i) => new TableCell({
      borders: cellBorders,
      width: { size: widths[i], type: WidthType.DXA },
      shading: bg ? { fill: bg, type: ShadingType.CLEAR } : undefined,
      margins: { top: 50, bottom: 50, left: 100, right: 100 },
      children: [new Paragraph({ children: [new TextRun({ text: String(t), font: "Microsoft YaHei", size: 19 })] })],
    }))
  });
}

function subTitle(text) {
  return new Paragraph({
    spacing: { before: 200, after: 100 },
    children: [new TextRun({ text, bold: true, font: "Microsoft YaHei", size: 22, color: DARK })],
    border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: BLUE, space: 4 } },
  });
}

function bodyText(text) {
  return new Paragraph({
    spacing: { before: 60, after: 60 },
    children: [new TextRun({ text, font: "Microsoft YaHei", size: 21 })],
  });
}

function bullet(text, ref = "bullets") {
  return new Paragraph({
    numbering: { reference: ref, level: 0 },
    spacing: { before: 30, after: 30 },
    children: [new TextRun({ text, font: "Microsoft YaHei", size: 21 })],
  });
}

const doc = new Document({
  styles: {
    default: { document: { run: { font: "Microsoft YaHei", size: 21 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, font: "Microsoft YaHei", color: DARK },
        paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: "Microsoft YaHei", color: BLUE },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 } },
    ]
  },
  numbering: {
    config: [
      { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "numbers", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    ]
  },
  sections: [
    // ======== COVER PAGE ========
    {
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      children: [
        new Paragraph({ spacing: { before: 2400 } }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 },
          children: [new TextRun({ text: "跨境电商运营实战手册", bold: true, font: "Microsoft YaHei", size: 56, color: DARK })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 600 },
          children: [new TextRun({ text: "TikTok Shop · Shopee · Lazada · Amazon", font: "Microsoft YaHei", size: 28, color: BLUE })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 },
          children: [new TextRun({ text: "从选品到财务，从投流到合规", font: "Microsoft YaHei", size: 24, color: "666666" })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 },
          children: [new TextRun({ text: "覆盖全链路跨境电商核心知识体系", font: "Microsoft YaHei", size: 24, color: "666666" })] }),
        new Paragraph({ spacing: { before: 1200 } }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "博众智汇 · 全域跨境经营管理系统", font: "Microsoft YaHei", size: 22, color: "999999" })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "2025年6月", font: "Microsoft YaHei", size: 20, color: "999999" })] }),
      ],
    },

    // ======== PAGE 2: TOC ========
    {
      properties: {
        page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } },
      },
      headers: {
        default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "博众智汇 · 跨境电商实战手册", font: "Microsoft YaHei", size: 16, color: "999999", italics: true })], border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR, space: 4 } } })] }),
      },
      footers: {
        default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "第 ", font: "Microsoft YaHei", size: 16, color: "999999" }), new TextRun({ children: [PageNumber.CURRENT], font: "Microsoft YaHei", size: 16, color: "999999" }), new TextRun({ text: " 页", font: "Microsoft YaHei", size: 16, color: "999999" })], border: { top: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR, space: 4 } } })] }),
      },
      children: [
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("目  录")] }),
        new Paragraph({ spacing: { after: 120 } }),
        ...[
          "第一章  跨境电商概述与平台对比",
          "第二章  选品方法论与定价策略",
          "第三章  成本结构与利润模型",
          "第四章  ROI 计算与分析实战",
          "第五章  TikTok Shop 运营核心",
          "第六章  短视频创作与直播带货",
          "第七章  TikTok Ads 广告投放",
          "第八章  广告指标分析与优化",
          "第九章  跨境物流与供应链管理",
          "第十章  数据分析体系与方法",
          "第十一章  合规经营与风险防控",
          "第十二章  常用工具与成功案例",
          "第十三章  常见错误与避坑指南",
        ].map(t => new Paragraph({ spacing: { before: 80, after: 80 }, children: [new TextRun({ text: t, font: "Microsoft YaHei", size: 21 })] })),
      ],
    },

    // ======== CHAPTER 1 ========
    {
      properties: {
        page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } },
      },
      headers: {
        default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "博众智汇 · 跨境电商实战手册", font: "Microsoft YaHei", size: 16, color: "999999", italics: true })], border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR, space: 4 } } })] }),
      },
      footers: {
        default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "第 ", font: "Microsoft YaHei", size: 16, color: "999999" }), new TextRun({ children: [PageNumber.CURRENT], font: "Microsoft YaHei", size: 16, color: "999999" }), new TextRun({ text: " 页", font: "Microsoft YaHei", size: 16, color: "999999" })], border: { top: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR, space: 4 } } })] }),
      },
      children: [
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("第一章  跨境电商概述与平台对比")] }),

        subTitle("1.1 跨境电商是什么"),
        bodyText("跨境电商（Cross-Border E-Commerce）是指分属不同关境的交易主体，通过电子商务平台达成交易、支付结算，并通过跨境物流送达商品的国际商业活动。2023年全球跨境电商市场规模约2.8万亿美元，东南亚市场年增长率达15-20%，是增速最快的区域。"),

        subTitle("1.2 主要平台对比"),
        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [1600, 1800, 1400, 1600, 1400, 1560],
          rows: [
            headerRow(["平台", "核心市场", "模式", "佣金", "物流", "特点"], [1600, 1800, 1400, 1600, 1400, 1560]),
            dataRow(["TikTok Shop", "东南亚+英美", "社交/直播", "1%-5%", "FBT/海外仓", "内容驱动"], [1600, 1800, 1400, 1600, 1400, 1560], LIGHT_BG),
            dataRow(["Shopee", "东南亚+拉美", "平台电商", "2%-5%", "SLS物流", "价格敏感"], [1600, 1800, 1400, 1600, 1400, 1560]),
            dataRow(["Lazada", "东南亚六国", "品牌商城", "2%-4%", "LGS物流", "品牌化"], [1600, 1800, 1400, 1600, 1400, 1560], LIGHT_BG),
            dataRow(["Amazon", "全球", "FBA/FBM", "8%-15%", "FBA", "规则严格"], [1600, 1800, 1400, 1600, 1400, 1560]),
            dataRow(["独立站", "全球", "D2C品牌", "0%", "自建", "品牌自主"], [1600, 1800, 1400, 1600, 1400, 1560], LIGHT_BG),
          ],
        }),

        subTitle("1.3 东南亚市场特征"),
        bodyText("东南亚总人口约6.8亿，互联网渗透率超过70%。2023年电商GMV约1390亿美元，预计2025年达1860亿美元。"),
        bullet("印尼是最大市场（占50%+），人口2.7亿，COD货到付款仍占40%以上"),
        bullet("泰国美妆护肤需求强劲，客单价$8-20"),
        bullet("越南人口年轻（平均32岁），电商增速最快"),
        bullet("马来西亚多语言环境（马来/中/英），客单价较高$8-25"),
        bullet("菲律宾英语普及，社交电商渗透率极高"),

        new Paragraph({ children: [new PageBreak()] }),
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("第二章  选品方法论与定价策略")] }),

        subTitle("2.1 选品核心原则：利润+物流+合规+需求"),
        bullet("毛利率≥30%为基本线，售价至少为采购成本的3倍以上"),
        bullet("优先体积小、重量轻、不易碎的产品（降低物流成本）"),
        bullet("不触碰禁售类目，知识产权清晰无侵权风险"),
        bullet("非纯季节性产品，复购率高，市场需求持续增长"),

        subTitle("2.2 四大选品方法"),
        bullet("数据选品：TikTok播放量/1688热卖品/Google Trends趋势"),
        bullet("竞品分析：搜索品类关键词→筛选高播放视频→分析评论区"),
        bullet("趋势选品：关注#TikTokMadeMeBuyIt话题，发现爆款产品"),
        bullet("供应链选品：找可定制差异化产品，评估起订量和供货周期"),

        subTitle("2.3 爆品特征总结"),
        bullet("视觉冲击力强（适合15秒短视频展示）"),
        bullet("解决了某个明确的用户痛点"),
        bullet("价格在$5-$30之间（冲动消费黄金区间）"),
        bullet("30秒内能讲清楚产品价值"),
        bullet("有\"哇\"的惊喜感"),

        subTitle("2.4 定价策略"),
        bodyText("通用公式：售价 = 产品成本 + 利润 + 平台佣金 + 物流成本 + 广告预算 + 退货损耗 + 其他费用"),
        bodyText("建议定价倍数：东南亚3-4倍 / 欧美4-6倍 / 中东4-8倍"),
        bullet("渗透定价（低价入市）：适合新品冷启动，抢占份额"),
        bullet("撇脂定价（高开低走）：适合差异化产品，早期高利润"),
        bullet("心理定价：$19.99代替$20，3件$29代替单件$12"),
        bullet("优惠券定价：预留10-20%折扣空间用于活动"),

        new Paragraph({ children: [new PageBreak()] }),
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("第三章  成本结构与利润模型")] }),

        subTitle("3.1 跨境电商成本全景（以售价¥100为例）"),
        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [2800, 2200, 2200, 2160],
          rows: [
            headerRow(["成本项", "金额", "占比", "说明"], [2800, 2200, 2200, 2160]),
            dataRow(["产品成本", "¥20", "20%", "采购价+包装"], [2800, 2200, 2200, 2160], LIGHT_BG),
            dataRow(["物流成本", "¥15", "15%", "头程+尾程+仓储"], [2800, 2200, 2200, 2160]),
            dataRow(["平台佣金", "¥5", "5%", "平台交易抽成"], [2800, 2200, 2200, 2160], LIGHT_BG),
            dataRow(["广告营销", "¥15", "15%", "投放+达人"], [2800, 2200, 2200, 2160]),
            dataRow(["支付/换汇", "¥3", "3%", "跨境手续费"], [2800, 2200, 2200, 2160], LIGHT_BG),
            dataRow(["退货损耗", "¥3", "3%", "退货折损"], [2800, 2200, 2200, 2160]),
            dataRow(["运营管理", "¥5", "5%", "人工+ERP"], [2800, 2200, 2200, 2160], LIGHT_BG),
            dataRow(["合规税费", "¥3", "3%", "当地税/认证"], [2800, 2200, 2200, 2160]),
            dataRow(["净利润", "¥31", "31%", ""], [2800, 2200, 2200, 2160], "E2EFDA"),
          ],
        }),

        subTitle("3.2 核心利润指标"),
        bullet("毛利 = GMV - 退款 - 产品成本；毛利率健康线 ≥ 60%"),
        bullet("净利 = 毛利 - 佣金 - 物流 - 广告 - 人工 - 其他，净利率健康线 ≥ 15%"),
        bullet("盈亏平衡销量 = 固定成本 /（售价 - 变动成本）"),
        bullet("客单价健康区间视品类而定，目标持续提升"),

        subTitle("3.3 定价反向推导公式"),
        bodyText("已知目标利润率30%，反推售价："),
        bodyText("售价 = 总成本 / (1 - 利润率 - 佣金率 - 广告费率 - 退货损耗率)"),
        bodyText("示例：总成本¥35，目标利润30%，佣金5%，广告15%，退货3%"),
        bodyText("售价 = 35 / (1 - 0.30 - 0.05 - 0.15 - 0.03) = 35 / 0.47 = ¥74.47 → 定价¥75"),

        new Paragraph({ children: [new PageBreak()] }),
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("第四章  ROI 计算与分析实战")] }),

        subTitle("4.1 ROI 核心公式"),
        bodyText("ROI（投资回报率）= (收益 - 成本) / 成本 × 100%，是跨境电商最核心的盈利指标。"),
        bodyText("ROI > 0%盈利，= 0%持平，< 0%亏损。"),

        subTitle("4.2 五种ROI计算场景"),
        bullet("单品ROI = (售价 - 全成本) / 全成本 × 100%，最常见"),
        bullet("广告ROAS = GMV / 广告费。ROAS > 2可接受，> 4良好，> 8优秀"),
        bullet("达人ROI = 达人带货GMV × 利润率 / 达人费用。> 2才算有效"),
        bullet("直播ROI = 直播GMV / (主播费+投流+设备+成本)，按场次核算"),
        bullet("店铺ROI = 总利润 / 总投入 × 100%，每月财务结账"),

        subTitle("4.3 ROI预警线"),
        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [2000, 2000, 2000, 3360],
          rows: [
            headerRow(["产品类型", "健康ROI", "预警ROI", "淘汰线"], [2000, 2000, 2000, 3360]),
            dataRow(["引流款", "> 20%", "0-20%", "< -10%"], [2000, 2000, 2000, 3360], LIGHT_BG),
            dataRow(["利润款", "> 50%", "0-50%", "< 0%"], [2000, 2000, 2000, 3360]),
            dataRow(["爆款", "> 80%", "30-80%", "< 20%"], [2000, 2000, 2000, 3360], LIGHT_BG),
            dataRow(["新品(30天)", "可接受-20%~0%", "第31天需转正", "< -30%"], [2000, 2000, 2000, 3360]),
          ],
        }),

        subTitle("4.4 ROI 计算常见误区"),
        bullet("错误1：只看ROAS，没算产品成本和物流 → ROAS 2可能还在亏损"),
        bullet("错误2：没算退货损耗（退货率15%，真实收益要打折）"),
        bullet("错误3：没算汇率损失（提现换汇通常损失1-3%）"),
        bullet("错误4：没算人工成本（自己运营也有时间成本）"),
        bullet("错误5：只算单品不算整体（可能靠其他品补亏）"),

        subTitle("4.5 ROI 优化的5个方向"),
        bullet("提客单价：捆绑销售、满减满赠、关联推荐"),
        bullet("降采购：批量议价、多供应商比价、优化包装"),
        bullet("降物流：海外仓前置、优化体积、合并发货"),
        bullet("降广告：提升素材质量、精准受众、关停低ROI组"),
        bullet("降退货：详实描述、真人实拍、尺码表清晰"),

        new Paragraph({ children: [new PageBreak()] }),
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("第五章  TikTok Shop 运营核心")] }),

        subTitle("5.1 TikTok Shop 三种模式"),
        bullet("跨境店（Cross-Border）：中国直发，5-15天，适合测试需求"),
        bullet("本土店（Local）：本地发货1-3天，流量加权，转化高，需本地仓"),
        bullet("全托管（FBT）：平台负责物流售后，卖家只供货，利润低但省心"),

        subTitle("5.2 店铺核心健康指标"),
        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [2600, 1900, 4860],
          rows: [
            headerRow(["指标", "健康值", "说明"], [2600, 1900, 4860]),
            dataRow(["店铺评分", "≥ 4.5星", "用户评星均值，直接决定流量"], [2600, 1900, 4860], LIGHT_BG),
            dataRow(["按时发货率", "≥ 95%", "低于90%触发限流警告"], [2600, 1900, 4860]),
            dataRow(["退货率", "≤ 10%", "服装类10-25%属正常但要控制"], [2600, 1900, 4860], LIGHT_BG),
            dataRow(["24h响应率", "≥ 80%", "消费者消息须及时回复"], [2600, 1900, 4860]),
            dataRow(["差评率", "≤ 3%", "1-2星评价占比，直接影响转化"], [2600, 1900, 4860], LIGHT_BG),
          ],
        }),

        subTitle("5.3 TikTok 推荐算法逻辑"),
        bodyText("流量池阶梯：初始(100-500播放)→验证→千人流量池(1k-5k)→验证→万人池(10k-50k)→百万→病毒传播"),
        bullet("完播率最重要：用户是否完整看完视频"),
        bullet("互动率：点赞+评论+分享+收藏"),
        bullet("转发率：用户分享给朋友"),
        bullet("关注转化：看完后关注的比例"),

        subTitle("5.4 各市场运营差异"),
        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [1300, 1600, 1600, 1560, 1700, 1600],
          rows: [
            headerRow(["维度", "印尼", "泰国", "越南", "马来", "菲律宾"], [1300, 1600, 1600, 1560, 1700, 1600]),
            dataRow(["语言", "印尼语", "泰语", "越南语", "马来/中/英", "英语"], [1300, 1600, 1600, 1560, 1700, 1600], LIGHT_BG),
            dataRow(["最佳直播", "19-22点", "20-23点", "19-22点", "20-23点", "19-22点"], [1300, 1600, 1600, 1560, 1700, 1600]),
            dataRow(["客单价", "$5-15", "$8-20", "$3-10", "$8-25", "$3-12"], [1300, 1600, 1600, 1560, 1700, 1600], LIGHT_BG),
            dataRow(["热度品类", "时尚/美妆", "美妆/护肤", "服装/家居", "时尚/3C", "时尚/美妆"], [1300, 1600, 1600, 1560, 1700, 1600]),
            dataRow(["支付偏好", "COD", "银行卡", "COD", "银行卡", "COD"], [1300, 1600, 1600, 1560, 1700, 1600], LIGHT_BG),
          ],
        }),

        new Paragraph({ children: [new PageBreak()] }),
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("第六章  短视频创作与直播带货")] }),

        subTitle("6.1 爆款视频公式"),
        bodyText("钩子(3秒)→痛点/好奇(5秒)→产品展示(10秒)→效果对比(5秒)→CTA引导(2秒)"),
        bullet("黄金前3秒：抛出问题/展示对比/制造惊讶，切记不要\"大家好今天来...\""),
        bullet("每日发布2-3条，最佳时段当地12:00-14:00和19:00-22:00"),
        bullet("用平台热门BGM，标签3-5个精准+1-2个热门"),

        subTitle("6.2 视频类型矩阵"),
        bullet("产品展示(30%)：15-25秒介绍功能，突出核心卖点"),
        bullet("使用教程(20%)：30-60秒建立信任，展示真实效果"),
        bullet("开箱测评(15%)：20-30秒营造真实感"),
        bullet("对比测试(15%)：15-25秒凸显差异化优势"),
        bullet("用户反馈(10%)：10-20秒社交证明"),

        subTitle("6.3 直播排品策略（60分钟标准场）"),
        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [1500, 1800, 1800, 4260],
          rows: [
            headerRow(["时间段", "品类型", "数量", "目的"], [1500, 1800, 1800, 4260]),
            dataRow(["0-10分", "福利款", "1-2个", "拉停留/微利或平出"], [1500, 1800, 1800, 4260], LIGHT_BG),
            dataRow(["10-30分", "利润款", "2-3个", "赚利润/高毛利"], [1500, 1800, 1800, 4260]),
            dataRow(["30-45分", "爆款", "1-2个", "冲GMV/中利润"], [1500, 1800, 1800, 4260], LIGHT_BG),
            dataRow(["45-55分", "引流款", "1个", "拉在线人数"], [1500, 1800, 1800, 4260]),
            dataRow(["55-60分", "返场爆款", "1个", "收尾冲量"], [1500, 1800, 1800, 4260], LIGHT_BG),
          ],
        }),

        subTitle("6.4 直播核心指标"),
        bullet("场观：直播间总观看人数"),
        bullet("在线人数：实时观看数，目标稳定50+"),
        bullet("GPM（千次观看成交额）：目标>500，衡量流量的变现效率"),
        bullet("转化率：下单/观看，目标>2%"),

        subTitle("6.5 提升直播间留存的技巧"),
        bullet("每10分钟设置一个钩子（抽奖/福利款即将上架）"),
        bullet("互动提问扣1/扣2增加参与感"),
        bullet("价格悬念：\"这个价格你们绝对想不到\""),
        bullet("库存紧迫感：\"只有最后20单\""),

        new Paragraph({ children: [new PageBreak()] }),
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("第七章  TikTok Ads 广告投放")] }),

        subTitle("7.1 广告类型选择"),
        bullet("信息流广告（In-Feed Ads）：展示在推荐流中，最常用，CPM/CPC/oCPM计费"),
        bullet("Spark Ads：加热达人视频，适合内容放量，oCPM计费"),
        bullet("LIVE Ads：直播推广，引流直播间，CPA/oCPM计费"),
        bullet("TopView：开屏+信息流首位，只适合大促/品牌日"),

        subTitle("7.2 广告账户结构"),
        bodyText("1个Campaign → 3-5个Ad Group → 每个Ad Group 2-3个Ad（A/B测试）。日预算$20起/Ad Group。"),

        subTitle("7.3 受众定向策略"),
        bullet("地域：初期选核心城市，跑通后扩展"),
        bullet("年龄/性别：按产品精准匹配"),
        bullet("兴趣：选2-3个相关兴趣，避免过窄"),
        bullet("行为：优先高意向行为（购物/观看直播）"),
        bullet("自定义人群：用于再营销（访客/加购未付款）"),

        subTitle("7.4 出价策略"),
        bullet("最低成本Auto Bid：系统自动优化，适合新手起步"),
        bullet("目标成本Cost Cap：设定CPA天花板，控制单次转化成本"),
        bullet("出价上限Bid Cap：手动完全控制，适合经验丰富者"),

        subTitle("7.5 广告优化节奏"),
        bullet("新素材跑24小时给学习期"),
        bullet("效果差（CPA高）：8小时内关停止损"),
        bullet("效果好：缓慢加预算，每日≤30%"),
        bullet("每周至少更新1次素材，避免疲劳衰减"),

        new Paragraph({ children: [new PageBreak()] }),
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("第八章  广告指标分析与优化")] }),

        subTitle("8.1 核心广告指标"),
        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [1400, 2000, 1600, 1400, 2960],
          rows: [
            headerRow(["指标", "全称", "计算方式", "基准", "优化方向"], [1400, 2000, 1600, 1400, 2960]),
            dataRow(["CTR", "点击率", "点击/展示", "≥1%", "换素材钩子/封面"], [1400, 2000, 1600, 1400, 2960], LIGHT_BG),
            dataRow(["CVR", "转化率", "转化/点击", "≥2%", "优化落地页/价格"], [1400, 2000, 1600, 1400, 2960]),
            dataRow(["CPA", "获客成本", "花费/转化", "按品类", "精准定向/提素材"], [1400, 2000, 1600, 1400, 2960], LIGHT_BG),
            dataRow(["CPM", "千次展示", "花费/展示×1000", "$1-15", "放宽定向/提预算"], [1400, 2000, 1600, 1400, 2960]),
            dataRow(["ROAS", "广告回报", "GMV/花费", "≥3", "综合优化素材+页"], [1400, 2000, 1600, 1400, 2960], LIGHT_BG),
          ],
        }),

        subTitle("8.2 ROAS ≠ 利润！真实案例"),
        bodyText("广告$1000带来$3000 GMV，ROAS = 3，看起来不错？"),
        bodyText("实际计算：退款15%(¥450)+佣金5%(¥150)+产品25%(¥750)+物流15%(¥450)-广告$1000 = 仅剩$200利润！"),
        bodyText("真ROI = 200/1000 = 20%，远比ROAS=3看起来低得多。"),

        subTitle("8.3 广告优化决策树"),
        bodyText("ROAS≥4,CVR≥3% → ✅加预算(≤30%/天)"),
        bodyText("ROAS 2-4,CVR 2-3% → ⚠️观察，小幅优化素材"),
        bodyText("ROAS 1-2,CVR 1-2% → 🔧换素材/定向/出价"),
        bodyText("ROAS<1,CVR<1% → ❌关停，重分析产品"),
        bodyText("CTR高但CVR低 → 产品页有问题（价格/评价）"),

        new Paragraph({ children: [new PageBreak()] }),
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("第九章  跨境物流与供应链管理")] }),

        subTitle("9.1 物流模式对比"),
        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [1600, 1100, 2160, 1100, 3400],
          rows: [
            headerRow(["模式", "时效", "适用", "成本", "注意事项"], [1600, 1100, 2160, 1100, 3400]),
            dataRow(["直邮小包", "7-15天", "测试/小件", "低", "丢包率高，适合低单价"], [1600, 1100, 2160, 1100, 3400], LIGHT_BG),
            dataRow(["专线物流", "5-10天", "稳定订单", "中", "有清关风险"], [1600, 1100, 2160, 1100, 3400]),
            dataRow(["海外仓", "1-3天", "爆款/爆品", "中高", "需压仓，日均≥30单才值"], [1600, 1100, 2160, 1100, 3400], LIGHT_BG),
            dataRow(["TikTok FBT", "1-3天", "全托管", "扣点高", "平台主导，低利润"], [1600, 1100, 2160, 1100, 3400]),
          ],
        }),

        subTitle("9.2 头程物流"),
        bullet("海运：15-30天，$1-3/kg，适合大件重货"),
        bullet("空运：3-7天，$3-8/kg，适合高值轻小件"),
        bullet("陆运：3-7天，$1-2/kg，适合中越/中泰陆路"),

        subTitle("9.3 库存管理核心公式"),
        bodyText("安全库存 = 日均销量 × 补货周期（天） × 安全系数（1.3-1.5）"),
        bodyText("补货点 = 安全库存 + 日均销量 × 头程天数"),

        subTitle("9.4 供应链风险防控"),
        bullet("分散供应商：核心品类至少2-3家供应商"),
        bullet("合同约束：交期、质量、违约条款明确"),
        bullet("库存缓冲：预留10%-20%安全库存"),
        bullet("质量管控：抽检/全检，出库前确认"),

        new Paragraph({ children: [new PageBreak()] }),
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("第十章  数据分析体系")] }),

        subTitle("10.1 日度核心监控指标"),
        bullet("销售概览：GMV、订单数、客单价、环比/同比"),
        bullet("产品排行：TOP 20热销产品，关注动销率"),
        bullet("流量分析：自然/直播/达人/付费各渠道转化对比"),
        bullet("广告数据：各广告组ROAS、CPA每日跟踪"),

        subTitle("10.2 漏斗分析法"),
        bodyText("曝光100,000 → 点击5,000(CTR 5%) → 加购500(10%) → 下单200(40%) → 付款160(80%)"),
        bullet("CTR低→优化主图/标题/钩子"),
        bullet("加购率低→优化详情页/价格"),
        bullet("下单率低→优化价格/促销/评价"),
        bullet("付款率低→优化支付流程（东南亚COD很关键）"),

        subTitle("10.3 RFM 用户分层"),
        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [1800, 1600, 1600, 1600, 2760],
          rows: [
            headerRow(["类型", "最近购买", "购买频率", "消费金额", "运营策略"], [1800, 1600, 1600, 1600, 2760]),
            dataRow(["重要价值", "近", "高", "高", "VIP维护/专属折扣"], [1800, 1600, 1600, 1600, 2760], LIGHT_BG),
            dataRow(["重要发展", "近", "低", "高", "推套装/满减"], [1800, 1600, 1600, 1600, 2760]),
            dataRow(["重要挽留", "远", "高", "高", "优惠券召回"], [1800, 1600, 1600, 1600, 2760], LIGHT_BG),
            dataRow(["一般价值", "近", "高", "低", "推高价款"], [1800, 1600, 1600, 1600, 2760]),
          ],
        }),

        new Paragraph({ children: [new PageBreak()] }),
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("第十一章  合规经营与风险防控")] }),

        subTitle("11.1 TikTok Shop 平台红线"),
        bullet("延迟发货：发货率低于90%→触发限流警告"),
        bullet("虚假发货：空包/错包→扣分，严重者封店"),
        bullet("引导站外交易：电话/微信/WhatsApp→永久封禁"),
        bullet("虚假宣传：夸大功效→商品下架+罚款"),
        bullet("价格欺诈：虚构原价→扣分处罚"),
        bullet("刷单刷评：虚假交易→直接封店"),

        subTitle("11.2 知识产权防控"),
        bullet("商标：不使用他人品牌名/LOGO"),
        bullet("专利：不仿制他人专利设计"),
        bullet("版权：图片/视频素材原创或已授权"),
        bullet("每次上新前排查产品外观/设计是否有专利冲突"),

        subTitle("11.3 东南亚税务要点"),
        bullet("印尼：增值税11%+进口税7.5%-20%"),
        bullet("泰国：增值税7%（起征点1500THB）"),
        bullet("越南：增值税10%（起征点1M VND）"),
        bullet("马来西亚：SST 6%+进口关税"),
        bullet("菲律宾：增值税12%（起征点10000PHP）"),

        subTitle("11.4 风险防控矩阵"),
        bullet("账号封禁（概率中/危害致命）→ 多账号矩阵+合规运营"),
        bullet("资金冻结（概率中/危害严重）→ 分散回款+多第三方支付"),
        bullet("侵权诉讼（概率低/危害致命）→ 知识产权全面排查"),
        bullet("汇率波动（概率高/危害中等）→ 多币种账户+锁汇"),

        new Paragraph({ children: [new PageBreak()] }),
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("第十二章  常用工具与成功案例")] }),

        subTitle("12.1 工具分类清单"),
        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [2000, 2500, 2000, 2860],
          rows: [
            headerRow(["分类", "推荐工具", "费用", "用途"], [2000, 2500, 2000, 2860]),
            dataRow(["ERP管理", "店小秘/马帮ERP", "免费起", "多平台订单库存"], [2000, 2500, 2000, 2860], LIGHT_BG),
            dataRow(["TikTok分析", "Kalodata/Tabcut", "$29+/月", "达人/商品/直播"], [2000, 2500, 2000, 2860]),
            dataRow(["选品工具", "1688/知虾", "免费起", "热卖品搜索"], [2000, 2500, 2000, 2860], LIGHT_BG),
            dataRow(["内容创作", "CapCut/Canva", "免费", "视频剪辑/设计"], [2000, 2500, 2000, 2860]),
            dataRow(["AI辅助", "ChatGPT/DeepSeek", "免费", "文案/脚本/分析"], [2000, 2500, 2000, 2860], LIGHT_BG),
            dataRow(["跨境收款", "Payoneer/PingPong", "0.8-1%", "收款换汇"], [2000, 2500, 2000, 2860]),
            dataRow(["数据分析", "Excel/Google Analytics", "免费", "报表/独立站"], [2000, 2500, 2000, 2860], LIGHT_BG),
          ],
        }),

        subTitle("12.2 成功案例：印尼3C配件月销$30万"),
        bullet("深圳卖家，主攻手机壳品类，印尼本土仓+本土店"),
        bullet("每天发布3-5条短视频+合作50+腰部达人(纯佣)"),
        bullet("日均直播4小时，主打性价比"),
        bullet("关键因素：本土化(货+人+语)+内容高频更新"),

        subTitle("12.3 成功案例：国货美妆泰国冷启动"),
        bullet("预算仅$5000，找5个中腰部美妆达人寄样试用"),
        bullet("达人出测评视频→Spark Ads加热→爆了后直播间承接"),
        bullet("3个月月GMV从$0→$8万，ROAS稳定3.5+，复购率18%"),
        bullet("核心经验：达人测评+Spark Ads是美妆最快起量方式"),

        new Paragraph({ children: [new PageBreak()] }),
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("第十三章  常见错误与避坑指南")] }),

        subTitle("新手最常犯的10个致命错误"),
        bullet("1. 上来就铺大货不测试 → 先单品测试验证再扩展"),
        bullet("2. 不算隐性成本就定价 → 全链路成本核算后再定价"),
        bullet("3. 广告预算失控 → 设好每日预算上限，不超支"),
        bullet("4. 忽略退货损耗 → 定价必须计入退货成本"),
        bullet("5. 素材从不更新 → 导致疲劳衰减，ROAS直线下降"),
        bullet("6. 频繁调广告 → 不给算法学习期(24-48h)"),
        bullet("7. 贪多求全 → 先深耕1-2个市场，跑通再复制"),
        bullet("8. 完全模仿竞品 → 必须有差异化才有竞争力"),
        bullet("9. 不做数据复盘 → 每天至少花30分钟看数据"),
        bullet("10. 单纯靠低价竞争 → 价格战不可持续"),

        subTitle("最后的话"),
        bodyText("跨境电商是一个需要持续学习和迭代的行业。市场在变、平台规则在变、消费者偏好在变。唯有用数据驱动决策，用内容建立壁垒，用合规守住底线，才能在这个行业长期盈利。"),
        bodyText(""),
        bodyText("祝各位卖家大卖！🎉"),
        bodyText(""),
        bodyText("— 博众智汇 · 全域跨境经营管理系统"),
      ],
    },
  ],
});

const outPath = "f:/tiktok-crm/docs/knowledge-base/跨境电商运营实战手册.docx";
Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(outPath, buf);
  console.log("DOCX created:", outPath);
}).catch(err => { console.error(err); process.exit(1); });
