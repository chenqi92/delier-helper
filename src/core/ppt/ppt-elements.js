/**
 * PPT 元素词汇表（封闭集合）
 *
 * 整套系统只认这几种元素类型；版式构建器、HTML 预览编辑器、pptx 导出器
 * 全部消费同一份 elements[]。任何元素新增字段必须三方同步。
 *
 * 公共字段：id, type, x, y, w, h（英寸）, rot（度）, opacity(0..1), locked
 *
 * type:
 *  - 'text'      文本框：text(单一样式，\n 换行) 或 paragraphs[]（逐段不同样式）
 *  - 'rect' | 'roundRect' | 'ellipse'  形状：fill / line / radius / shadow
 *  - 'line'      直线：lineColor / lineWidth / dash（从 (x,y) 到 (x+w,y+h)）
 *  - 'image'     图片：src(dataURL/绝对路径) / sizing / frame
 *  - 'icon'      图标：name(图标库键) / color / chip(圆片底)
 */

let _seq = 0
export function uid(prefix = 'el') {
  _seq = (_seq + 1) % 1e6
  return `${prefix}_${Date.now().toString(36)}_${_seq}_${Math.floor(Math.random() * 1e4).toString(36)}`
}

const baseDefaults = () => ({ rot: 0, opacity: 1, locked: false })

export const E = {
  text(o = {}) {
    return {
      id: uid('tx'), type: 'text', x: 1, y: 1, w: 4, h: 1,
      ...baseDefaults(),
      text: '', paragraphs: null,
      fontFace: 'Calibri', fontSize: 16, color: '111827',
      bold: false, italic: false, align: 'left', valign: 'top',
      bullet: false, lineSpacing: 0, charSpacing: 0, wrap: true, shrink: false, shadow: false,
      ...o,
    }
  },
  rect(o = {}) {
    return {
      id: uid('rc'), type: 'rect', x: 1, y: 1, w: 3, h: 1.5,
      ...baseDefaults(),
      fill: 'EEEEEE', fillAlpha: 1, line: null, radius: 0, shadow: false,
      ...o,
    }
  },
  roundRect(o = {}) {
    return {
      id: uid('rr'), type: 'roundRect', x: 1, y: 1, w: 3, h: 1.5,
      ...baseDefaults(),
      fill: 'EEEEEE', fillAlpha: 1, line: null, radius: 0.12, shadow: false,
      ...o,
    }
  },
  ellipse(o = {}) {
    return {
      id: uid('el'), type: 'ellipse', x: 1, y: 1, w: 1, h: 1,
      ...baseDefaults(),
      fill: 'EEEEEE', fillAlpha: 1, line: null, shadow: false,
      ...o,
    }
  },
  line(o = {}) {
    return {
      id: uid('ln'), type: 'line', x: 1, y: 1, w: 3, h: 0,
      ...baseDefaults(),
      lineColor: '888888', lineWidth: 1, dash: 'solid',
      ...o,
    }
  },
  image(o = {}) {
    return {
      id: uid('im'), type: 'image', x: 1, y: 1, w: 4, h: 3,
      ...baseDefaults(),
      src: '', sizing: 'contain', radius: 0, frame: false, frameColor: '1F2933',
      ...o,
    }
  },
  icon(o = {}) {
    return {
      id: uid('ic'), type: 'icon', x: 1, y: 1, w: 0.5, h: 0.5,
      ...baseDefaults(),
      name: 'box', color: '111827', strokeWidth: 2,
      chip: false, chipColor: 'EEEEEE', chipAlpha: 1, chipRound: true,
      ...o,
    }
  },
}

/** 把文本元素归一化成「逐段」数组，HTML 与 pptx 共用 */
export function textParagraphs(el) {
  if (Array.isArray(el.paragraphs) && el.paragraphs.length) {
    return el.paragraphs.map(p => ({
      text: p.text ?? '',
      fontSize: p.fontSize ?? el.fontSize,
      bold: p.bold ?? el.bold,
      italic: p.italic ?? el.italic,
      color: p.color ?? el.color,
      align: p.align ?? el.align,
      bullet: p.bullet ?? el.bullet,
      spaceAfter: p.spaceAfter ?? 0,
      lineSpacing: p.lineSpacing ?? el.lineSpacing,
    }))
  }
  return String(el.text ?? '').split('\n').map(t => ({
    text: t, fontSize: el.fontSize, bold: el.bold, italic: el.italic,
    color: el.color, align: el.align, bullet: el.bullet, spaceAfter: 0, lineSpacing: el.lineSpacing,
  }))
}

/** 深拷贝并赋新 id（含子元素），供「复制元素」 */
export function cloneElement(el, dx = 0.25, dy = 0.25) {
  const copy = JSON.parse(JSON.stringify(el))
  copy.id = uid(el.type === 'text' ? 'tx' : 'el')
  copy.x = +(copy.x + dx).toFixed(3)
  copy.y = +(copy.y + dy).toFixed(3)
  return copy
}

/** 新建一页 */
export function newSlide(props = {}) {
  return {
    id: uid('sld'),
    role: 'content',
    layout: 'blank',
    background: { type: 'color', color: 'FFFFFF' },
    elements: [],
    notes: '',
    ...props,
  }
}
