<template>
  <div v-if="enabled && currentStep" class="guide-tour">
    <div
      class="guide-highlight"
      :style="highlightStyle"
    ></div>
    <div
      class="guide-tooltip"
      :style="tooltipStyle"
      :class="tooltipPlacement"
    >
      <div class="guide-tooltip-content">
        <span class="guide-step-badge">{{ currentIndex + 1 }}/{{ steps.length }}</span>
        {{ currentStep.text }}
      </div>
      <div class="guide-tooltip-actions">
        <button v-if="currentIndex > 0" class="guide-btn" @click="prev">上一步</button>
        <button v-if="currentIndex < steps.length - 1" class="guide-btn guide-btn-primary" @click="next">下一步</button>
        <button v-else class="guide-btn guide-btn-primary" @click="finish">完成</button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'GuideTour',
  props: {
    steps: { type: Array, required: true },
    enabled: { type: Boolean, default: true },
    // 外部传入条件 map，用于自动推进步骤
    conditions: { type: Object, default: () => ({}) },
  },
  data() {
    return {
      currentIndex: 0,
      highlightStyle: {},
      tooltipStyle: {},
      tooltipPlacement: 'guide-tooltip-bottom',
      _raf: null,
      _observer: null,
    }
  },
  computed: {
    currentStep() {
      return this.steps[this.currentIndex] || null
    },
  },
  watch: {
    enabled(val) {
      if (val) this.startTracking()
      else this.stopTracking()
    },
    currentIndex() {
      this.updatePosition()
    },
    conditions: {
      deep: true,
      handler() {
        this.autoAdvance()
      },
    },
    steps() {
      this.currentIndex = 0
      this.autoAdvance()
      this.$nextTick(() => this.updatePosition())
    },
  },
  mounted() {
    this.autoAdvance()
    if (this.enabled) this.startTracking()
  },
  beforeUnmount() {
    this.stopTracking()
  },
  methods: {
    autoAdvance() {
      // 自动跳到第一个未完成的步骤
      for (let i = 0; i < this.steps.length; i++) {
        const step = this.steps[i]
        if (step.doneWhen && this.conditions[step.doneWhen]) {
          continue
        }
        this.currentIndex = i
        return
      }
      // 全部完成
      this.currentIndex = this.steps.length
    },
    next() {
      if (this.currentIndex < this.steps.length - 1) this.currentIndex++
    },
    prev() {
      if (this.currentIndex > 0) this.currentIndex--
    },
    finish() {
      this.$emit('finish')
    },
    startTracking() {
      this.updatePosition()
      this._raf = setInterval(() => this.updatePosition(), 500)
    },
    stopTracking() {
      if (this._raf) { clearInterval(this._raf); this._raf = null }
    },
    updatePosition() {
      if (!this.currentStep) return
      const el = document.querySelector(`[data-guide="${this.currentStep.target}"]`)
      if (!el) {
        this.highlightStyle = { display: 'none' }
        this.tooltipStyle = { display: 'none' }
        return
      }

      const rect = el.getBoundingClientRect()
      const pad = 4

      this.highlightStyle = {
        display: 'block',
        top: `${rect.top - pad}px`,
        left: `${rect.left - pad}px`,
        width: `${rect.width + pad * 2}px`,
        height: `${rect.height + pad * 2}px`,
      }

      // 决定 tooltip 位置
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceRight = window.innerWidth - rect.right

      if (spaceBelow > 100) {
        this.tooltipPlacement = 'guide-tooltip-bottom'
        this.tooltipStyle = {
          display: 'block',
          top: `${rect.bottom + pad + 8}px`,
          left: `${Math.max(8, Math.min(rect.left, window.innerWidth - 280))}px`,
        }
      } else if (rect.top > 100) {
        this.tooltipPlacement = 'guide-tooltip-top'
        this.tooltipStyle = {
          display: 'block',
          top: `${rect.top - pad - 8}px`,
          left: `${Math.max(8, Math.min(rect.left, window.innerWidth - 280))}px`,
          transform: 'translateY(-100%)',
        }
      } else if (spaceRight > 280) {
        this.tooltipPlacement = 'guide-tooltip-right'
        this.tooltipStyle = {
          display: 'block',
          top: `${rect.top}px`,
          left: `${rect.right + pad + 8}px`,
        }
      } else {
        this.tooltipPlacement = 'guide-tooltip-left'
        this.tooltipStyle = {
          display: 'block',
          top: `${rect.top}px`,
          left: `${rect.left - pad - 8}px`,
          transform: 'translateX(-100%)',
        }
      }
    },
  },
}
</script>
