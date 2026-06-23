/**
 * PPT 模板（deck 模板）
 *
 * 模板定义：风格 + 编排方式。
 *  - mode 'ai'   ：智能编排，用户设定页数生效，模板只固定风格（脱离固定骨架）
 *  - mode 'fixed'：固定章节骨架，页数 = skeleton 长度
 *
 * skeleton 项：{ layout, title }（title 作为 AI 填充内容时的标题提示）
 */

export function getPptPresets() {
  return [
    {
      id: 'ppt-auto', name: '智能编排（推荐）', mode: 'ai', styleId: 'auto',
      description: '脱离固定模板，由 AI 按内容与页数自动挑版式、配节奏、选风格',
    },
    {
      id: 'ppt-tech', name: '科技产品 · 深色', mode: 'ai', styleId: 'tech-dark',
      description: '暗黑科技风，适合 AI / 平台 / 技术产品介绍',
    },
    {
      id: 'ppt-biz', name: '商务汇报 · 简洁', mode: 'ai', styleId: 'business-clean',
      description: '商务简洁风，适合向领导 / 客户汇报',
    },
    {
      id: 'ppt-mag', name: '产品故事 · 杂志', mode: 'ai', styleId: 'magazine',
      description: '杂志编辑风，大留白超大标题，适合发布 / 品牌叙事',
    },
    {
      id: 'ppt-trust', name: '方案介绍 · 青蓝', mode: 'ai', styleId: 'teal-trust',
      description: '青蓝信任风，适合 toB 方案 / 服务介绍',
    },
    {
      id: 'ppt-warm', name: '品牌温度 · 暖色', mode: 'ai', styleId: 'warm-brand',
      description: '暖色品牌风，圆角有机色块，适合品牌 / 文化 / 公益',
    },
    {
      id: 'ppt-forest', name: '绿色科技 · 森林', mode: 'ai', styleId: 'forest',
      description: '森林自然风，圆角与有机感，适合环保 / 农业 / 健康',
    },
    {
      id: 'ppt-luxe', name: '高端奢享 · 深绿', mode: 'ai', styleId: 'deep-green-luxe',
      description: '深绿金线风，居中对称，适合高端品牌 / 投资路演',
    },
    {
      id: 'ppt-coral', name: '活力发布 · 珊瑚', mode: 'ai', styleId: 'coral',
      description: '大色块拼贴 + 粗体标题，适合发布会 / 活动',
    },
    {
      id: 'ppt-mono', name: '极简灰度', mode: 'ai', styleId: 'mono',
      description: '细线留白极简风，适合极客 / 设计向汇报',
    },
    {
      id: 'ppt-punk', name: '高对比 · 朋克', mode: 'ai', styleId: 'punk',
      description: '荧光强调 + 强裁切，适合潮牌 / 创意展示',
    },
    {
      id: 'ppt-launch', name: '产品发布 · 叙事', mode: 'fixed', styleId: 'magazine',
      description: '杂志叙事骨架：金句 → 痛点 → 方案 → 数据 → 展望',
      skeleton: [
        { layout: 'cover', title: '产品发布' },
        { layout: 'quote', title: '一句话主张' },
        { layout: 'bullets', title: '痛点与机会' },
        { layout: 'iconCards', title: '解决方案' },
        { layout: 'featureGrid', title: '核心能力' },
        { layout: 'barChart', title: '关键数据' },
        { layout: 'timeline', title: '发布路线' },
        { layout: 'bigNumbers', title: '预期成效' },
        { layout: 'closing', title: '谢谢' },
      ],
    },
    {
      id: 'ppt-accept', name: '项目验收 · 标准结构', mode: 'fixed', styleId: 'business-clean',
      description: '固定骨架：背景 → 方案 → 能力 → 实施 → 成效',
      skeleton: [
        { layout: 'cover', title: '项目验收汇报' },
        { layout: 'toc', title: '目录' },
        { layout: 'section', title: '项目背景' },
        { layout: 'bullets', title: '背景与目标' },
        { layout: 'iconCards', title: '总体方案' },
        { layout: 'featureGrid', title: '核心能力' },
        { layout: 'textMedia', title: '功能详解' },
        { layout: 'timeline', title: '实施路径' },
        { layout: 'compareColumns', title: '建设前后对比' },
        { layout: 'bigNumbers', title: '建设成效' },
        { layout: 'closing', title: '谢谢观看' },
      ],
    },
  ]
}

/** 把当前 deck 抽取为可复用骨架（保存为自定义模板用） */
export function toDeckSkeleton(deck) {
  return {
    styleId: deck.styleId,
    skeleton: (deck.slides || []).map(s => ({ layout: s.layout, title: s.title || '' })),
  }
}
