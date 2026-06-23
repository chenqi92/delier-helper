<template>
  <div
    class="slide-canvas"
    :style="canvasStyle"
    @pointerdown.self="onBackgroundDown"
    @dblclick.self="$emit('update:selectedId', null)"
  >
    <template v-for="el in slide.elements" :key="el.id">
      <!-- 元素本体 -->
      <div
        class="ppt-el"
        :class="{ selected: interactive && el.id === selectedId, locked: el.locked }"
        :style="elBoxStyle(el)"
        @pointerdown="onElementDown($event, el)"
        @dblclick.stop="onElementDblClick(el)"
      >
        <!-- 文本 -->
        <div v-if="el.type === 'text'" class="el-text" :style="textContainerStyle(el)">
          <div v-for="(p, i) in paras(el)" :key="i" :style="paraStyle(p)">{{ p.bullet ? '• ' : '' }}{{ p.text || ' ' }}</div>
        </div>

        <!-- 形状 -->
        <div v-else-if="el.type === 'rect' || el.type === 'roundRect' || el.type === 'ellipse'" :style="shapeStyle(el)"></div>

        <!-- 直线 -->
        <div v-else-if="el.type === 'line'" :style="lineStyle(el)"></div>

        <!-- 图片 -->
        <img v-else-if="el.type === 'image'" :src="el.src" :style="imageStyle(el)" draggable="false" />

        <!-- 图标 -->
        <div v-else-if="el.type === 'icon'" style="width:100%;height:100%;position:relative;">
          <div v-if="el.chip" :style="chipStyle(el)"></div>
          <div :style="iconGlyphStyle(el)" v-html="iconMarkup(el)"></div>
        </div>

        <!-- 选中描边 + 缩放手柄 -->
        <template v-if="interactive && el.id === selectedId && editingId !== el.id">
          <div class="sel-outline"></div>
          <div
            v-for="h in handles" :key="h"
            class="sel-handle" :class="'h-' + h"
            @pointerdown.stop="onResizeDown($event, el, h)"
          ></div>
        </template>
      </div>

      <!-- 文本就地编辑浮层 -->
      <textarea
        v-if="editingId === el.id"
        :key="el.id + '-edit'"
        ref="editor"
        class="el-edit"
        :style="editBoxStyle(el)"
        v-model="editText"
        @blur="commitEdit(el)"
        @keydown.esc.prevent="cancelEdit"
        @keydown.enter.exact.prevent="commitEdit(el)"
        @pointerdown.stop
      ></textarea>
    </template>
  </div>
</template>

<script>
import { SLIDE_W, SLIDE_H, clamp, rgba } from '../core/ppt/ppt-geometry.js'
import { textParagraphs } from '../core/ppt/ppt-elements.js'
import { iconSvg } from '../core/ppt/ppt-icons.js'

export default {
  name: 'SlideCanvas',
  props: {
    slide: { type: Object, required: true },
    width: { type: Number, default: 900 },
    interactive: { type: Boolean, default: false },
    selectedId: { type: String, default: null },
  },
  emits: ['update:selectedId', 'change'],
  data() {
    return {
      handles: ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'],
      editingId: null,
      editText: '',
      drag: null,
    }
  },
  computed: {
    scale() { return this.width / SLIDE_W },
    canvasStyle() {
      return {
        width: this.width + 'px',
        height: (this.width * SLIDE_H / SLIDE_W) + 'px',
        background: '#' + (this.slide.background?.color || 'FFFFFF'),
      }
    },
  },
  methods: {
    px(inch) { return inch * this.scale },
    hexFill(hex, alpha = 1) { return rgba(hex, alpha) },
    paras(el) { return textParagraphs(el) },

    elBoxStyle(el) {
      return {
        left: this.px(el.x) + 'px',
        top: this.px(el.y) + 'px',
        width: this.px(el.w) + 'px',
        height: this.px(el.h) + 'px',
        transform: el.rot ? `rotate(${el.rot}deg)` : 'none',
        opacity: el.opacity == null ? 1 : el.opacity,
        cursor: this.interactive ? (el.id === this.selectedId ? 'move' : 'pointer') : 'default',
      }
    },
    textContainerStyle(el) {
      const j = el.valign === 'middle' ? 'center' : el.valign === 'bottom' ? 'flex-end' : 'flex-start'
      return { display: 'flex', flexDirection: 'column', justifyContent: j, width: '100%', height: '100%', overflow: 'hidden' }
    },
    paraStyle(p) {
      return {
        fontFamily: this.fontStack(p),
        fontSize: (p.fontSize * this.scale / 72) + 'px',
        lineHeight: p.lineSpacing ? (p.lineSpacing * this.scale / 72) + 'px' : 1.2,
        fontWeight: p.bold ? 700 : 400,
        fontStyle: p.italic ? 'italic' : 'normal',
        color: '#' + (p.color || '111827'),
        textAlign: p.align || 'left',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }
    },
    fontStack(p) {
      const f = p.fontFace || ''
      return `"${f}", "Microsoft YaHei", "PingFang SC", system-ui, sans-serif`
    },
    shapeStyle(el) {
      const s = {
        width: '100%', height: '100%', boxSizing: 'border-box',
        background: el.fill == null ? 'transparent' : this.hexFill(el.fill, el.fillAlpha == null ? 1 : el.fillAlpha),
      }
      if (el.line) {
        const w = Math.max(1, el.line.width * this.scale / 72)
        s.border = `${w}px ${el.line.dash === 'dash' ? 'dashed' : el.line.dash === 'dot' ? 'dotted' : 'solid'} #${el.line.color}`
      }
      if (el.type === 'ellipse') s.borderRadius = '50%'
      else if (el.type === 'roundRect') s.borderRadius = this.px(el.radius || 0) + 'px'
      if (el.shadow) s.boxShadow = '0 6px 18px rgba(20,30,50,0.18)'
      return s
    },
    lineStyle(el) {
      const w = this.px(Math.abs(el.w)), h = this.px(Math.abs(el.h))
      const thick = Math.max(1, (el.lineWidth || 1) * this.scale / 72)
      const dash = el.dash === 'dash' ? 'dashed' : el.dash === 'dot' ? 'dotted' : 'solid'
      if (h < 2) return { position: 'absolute', left: 0, top: (this.px(el.h) / 2 - thick / 2) + 'px', width: w + 'px', height: 0, borderTop: `${thick}px ${dash} #${el.lineColor}` }
      if (w < 2) return { position: 'absolute', left: (this.px(el.w) / 2 - thick / 2) + 'px', top: 0, width: 0, height: h + 'px', borderLeft: `${thick}px ${dash} #${el.lineColor}` }
      return { position: 'absolute', left: 0, top: 0, width: w + 'px', height: h + 'px', borderTop: `${thick}px ${dash} #${el.lineColor}` }
    },
    imageStyle(el) {
      const s = { width: '100%', height: '100%', objectFit: el.sizing === 'cover' ? 'cover' : 'contain', display: 'block' }
      if (el.radius) s.borderRadius = this.px(el.radius) + 'px'
      if (el.frame) { s.boxShadow = '0 8px 22px rgba(20,30,50,0.22)'; s.border = `1px solid #${el.frameColor || '1F2933'}` }
      return s
    },
    chipStyle(el) {
      return {
        position: 'absolute', inset: 0,
        background: this.hexFill(el.chipColor, el.chipAlpha == null ? 1 : el.chipAlpha),
        borderRadius: el.chipRound ? '50%' : this.px(0.08) + 'px',
      }
    },
    iconGlyphStyle(el) {
      if (!el.chip) return { position: 'absolute', inset: 0 }
      const g = 56
      const off = (100 - g) / 2
      return { position: 'absolute', left: off + '%', top: off + '%', width: g + '%', height: g + '%' }
    },
    iconMarkup(el) { return iconSvg(el.name, el.color, el.strokeWidth || 2) },

    // ===== 选择 / 拖动 =====
    onBackgroundDown() {
      if (this.interactive) this.$emit('update:selectedId', null)
    },
    onElementDown(e, el) {
      if (!this.interactive || el.locked) return
      e.stopPropagation()
      this.$emit('update:selectedId', el.id)
      if (this.editingId === el.id) return
      this.drag = {
        mode: 'move', el,
        startX: e.clientX, startY: e.clientY,
        orig: { x: el.x, y: el.y, w: el.w, h: el.h },
      }
      window.addEventListener('pointermove', this.onPointerMove)
      window.addEventListener('pointerup', this.onPointerUp)
    },
    onResizeDown(e, el, dir) {
      if (!this.interactive || el.locked) return
      this.drag = {
        mode: 'resize', el, dir,
        startX: e.clientX, startY: e.clientY,
        orig: { x: el.x, y: el.y, w: el.w, h: el.h },
      }
      window.addEventListener('pointermove', this.onPointerMove)
      window.addEventListener('pointerup', this.onPointerUp)
    },
    onPointerMove(e) {
      if (!this.drag) return
      const dx = (e.clientX - this.drag.startX) / this.scale
      const dy = (e.clientY - this.drag.startY) / this.scale
      const o = this.drag.orig, el = this.drag.el
      if (this.drag.mode === 'move') {
        el.x = +clamp(o.x + dx, -0.2, SLIDE_W - 0.2).toFixed(3)
        el.y = +clamp(o.y + dy, -0.2, SLIDE_H - 0.2).toFixed(3)
      } else {
        const d = this.drag.dir
        let nx = o.x, ny = o.y, nw = o.w, nh = o.h
        if (d.includes('e')) nw = o.w + dx
        if (d.includes('s')) nh = o.h + dy
        if (d.includes('w')) { nx = o.x + dx; nw = o.w - dx }
        if (d.includes('n')) { ny = o.y + dy; nh = o.h - dy }
        if (nw < 0.2) { nw = 0.2; if (d.includes('w')) nx = o.x + o.w - 0.2 }
        if (nh < 0.2) { nh = 0.2; if (d.includes('n')) ny = o.y + o.h - 0.2 }
        el.x = +nx.toFixed(3); el.y = +ny.toFixed(3); el.w = +nw.toFixed(3); el.h = +nh.toFixed(3)
      }
    },
    onPointerUp() {
      if (this.drag) { this.drag = null; this.$emit('change') }
      window.removeEventListener('pointermove', this.onPointerMove)
      window.removeEventListener('pointerup', this.onPointerUp)
    },

    // ===== 文本就地编辑 =====
    onElementDblClick(el) {
      if (!this.interactive || el.type !== 'text' || el.locked) return
      this.$emit('update:selectedId', el.id)
      this.editingId = el.id
      this.editText = this.paras(el).map(p => p.text).join('\n')
      this.$nextTick(() => {
        const ed = Array.isArray(this.$refs.editor) ? this.$refs.editor[0] : this.$refs.editor
        if (ed) { ed.focus(); ed.select() }
      })
    },
    editBoxStyle(el) {
      const p = this.paras(el)[0] || { fontSize: el.fontSize, color: el.color, align: el.align, bold: el.bold }
      return {
        left: this.px(el.x) + 'px', top: this.px(el.y) + 'px',
        width: this.px(el.w) + 'px', height: this.px(el.h) + 'px',
        fontFamily: this.fontStack(p), fontSize: (p.fontSize * this.scale / 72) + 'px',
        fontWeight: p.bold ? 700 : 400, color: '#' + (p.color || '111827'),
        textAlign: p.align || 'left',
      }
    },
    commitEdit(el) {
      if (this.editingId !== el.id) return
      if (Array.isArray(el.paragraphs) && el.paragraphs.length) {
        // 保留每段原有样式（字号/粗细/颜色），仅替换文字，避免富文本被压平
        const lines = this.editText.split('\n')
        const last = el.paragraphs[el.paragraphs.length - 1]
        el.paragraphs = lines.map((t, i) => ({ ...(el.paragraphs[i] || last || {}), text: t }))
      } else {
        el.text = this.editText
        el.paragraphs = null
      }
      this.editingId = null
      this.$emit('change')
    },
    cancelEdit() { this.editingId = null },
  },
  beforeUnmount() {
    window.removeEventListener('pointermove', this.onPointerMove)
    window.removeEventListener('pointerup', this.onPointerUp)
  },
}
</script>

<style scoped>
.slide-canvas {
  position: relative;
  overflow: hidden;
  user-select: none;
  box-shadow: 0 2px 16px rgba(0, 0, 0, 0.18);
}
.ppt-el {
  position: absolute;
}
.el-text { pointer-events: none; }
.sel-outline {
  position: absolute;
  inset: -1px;
  border: 1.5px solid var(--primary-500, #6366f1);
  pointer-events: none;
}
.sel-handle {
  position: absolute;
  width: 9px;
  height: 9px;
  background: #fff;
  border: 1.5px solid var(--primary-500, #6366f1);
  border-radius: 2px;
  z-index: 5;
}
.h-nw { left: -5px; top: -5px; cursor: nwse-resize; }
.h-n { left: calc(50% - 4px); top: -5px; cursor: ns-resize; }
.h-ne { right: -5px; top: -5px; cursor: nesw-resize; }
.h-e { right: -5px; top: calc(50% - 4px); cursor: ew-resize; }
.h-se { right: -5px; bottom: -5px; cursor: nwse-resize; }
.h-s { left: calc(50% - 4px); bottom: -5px; cursor: ns-resize; }
.h-sw { left: -5px; bottom: -5px; cursor: nesw-resize; }
.h-w { left: -5px; top: calc(50% - 4px); cursor: ew-resize; }
.el-edit {
  position: absolute;
  z-index: 10;
  border: 1.5px solid var(--primary-500, #6366f1);
  background: rgba(255, 255, 255, 0.96);
  color: #111;
  padding: 0;
  margin: 0;
  resize: none;
  outline: none;
  overflow: hidden;
  line-height: 1.2;
}
</style>
