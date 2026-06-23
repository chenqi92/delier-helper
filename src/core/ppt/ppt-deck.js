/**
 * Deck 数据模型与操作
 *
 * deck = {
 *   meta: { topic, audience, language, direction, footnote },
 *   styleId,
 *   slides: [ { id, role, layout, title, content, background, elements[], notes } ]
 * }
 *
 * slide.content 是「结构化内容」的事实来源：切换风格 = 用新风格从 content 重建 elements。
 * 手动编辑过的元素会在「重建/换风格/重生成」时被覆盖（封面/空白页除外）。
 */
import { getStyle, DEFAULT_STYLE_ID } from './ppt-styles.js'
import { buildSlide, LAYOUT_MAP } from './ppt-layouts.js'
import { newSlide } from './ppt-elements.js'
import { SLIDE_W, SLIDE_H } from './ppt-geometry.js'

export function createEmptyDeck(meta = {}, styleId = DEFAULT_STYLE_ID) {
  return {
    meta: { topic: '', audience: '', language: '中文', direction: '', footnote: '', ...meta },
    styleId,
    slides: [],
  }
}

/**
 * 用大纲构建整套 deck（每页用 sample/占位内容先出骨架，随后逐页填充）
 * @param {{styleId, slides:[{layout,title,intent,content?}]}} outline
 */
export function buildDeckFromOutline(outline, meta = {}) {
  const styleId = outline.styleId || DEFAULT_STYLE_ID
  const style = getStyle(styleId)
  const slides = outline.slides.map((s, i) => {
    const layout = LAYOUT_MAP[s.layout] || LAYOUT_MAP.bullets
    const content = s.content || { ...(layout.sample || {}), title: s.title || layout.sample?.title }
    const slide = buildSlide(s.layout, content, style, i + 1)
    slide.intent = s.intent || ''
    slide.pending = !s.content
    return slide
  })
  return { meta: { ...createEmptyDeck().meta, ...meta }, styleId, slides }
}

/** 用结构化内容重建某页（保留 id / notes） */
export function rebuildSlideInPlace(deck, slideIndex) {
  const slide = deck.slides[slideIndex]
  if (!slide || !slide.layout || slide.layout === 'blank') return slide
  const style = getStyle(deck.styleId)
  const rebuilt = buildSlide(slide.layout, slide.content || {}, style, slideIndex + 1)
  rebuilt.id = slide.id
  rebuilt.notes = slide.notes
  rebuilt.intent = slide.intent
  rebuilt.pending = slide.pending
  deck.slides.splice(slideIndex, 1, rebuilt)
  return rebuilt
}

/** 换风格：用新风格从每页 content 重建（封面/空白页若无 content 则保留手动元素） */
export function restyleDeck(deck, styleId) {
  deck.styleId = styleId
  const style = getStyle(styleId)
  deck.slides = deck.slides.map((s, i) => {
    if (s.layout && s.layout !== 'blank' && s.content && LAYOUT_MAP[s.layout]) {
      const rebuilt = buildSlide(s.layout, s.content, style, i + 1)
      rebuilt.id = s.id
      rebuilt.notes = s.notes
      rebuilt.intent = s.intent
      rebuilt.pending = s.pending
      return rebuilt
    }
    return s
  })
  return deck
}

/** 新增一页空白页 */
export function appendBlankSlide(deck) {
  const style = getStyle(deck.styleId)
  const s = newSlide({ layout: 'blank', role: 'content', title: '空白页', content: null })
  s.background = { type: 'color', color: style.colors.bgLight }
  deck.slides.push(s)
  return s
}

/** 几何自检：返回越界 / 非法坐标告警（运行时 + node 测试共用） */
export function validateDeck(deck) {
  const warns = []
  ;(deck.slides || []).forEach((s, si) => {
    ;(s.elements || []).forEach((el) => {
      const vals = [el.x, el.y, el.w, el.h]
      if (vals.some(v => typeof v !== 'number' || Number.isNaN(v))) {
        warns.push(`第${si + 1}页 ${el.type} 坐标非数值`)
        return
      }
      if (el.decor) return // 故意出血的装饰元素，跳过越界检查
      if (el.x < -0.12 || el.y < -0.12 || el.x + el.w > SLIDE_W + 0.12 || el.y + el.h > SLIDE_H + 0.12) {
        warns.push(`第${si + 1}页 ${el.type} 越界 (x${el.x.toFixed(2)} y${el.y.toFixed(2)} w${el.w.toFixed(2)} h${el.h.toFixed(2)})`)
      }
    })
  })
  return warns
}
