<template>
  <div class="tab-nav" ref="tabNavRef">
    <div
      class="tab-indicator"
      :style="indicatorStyle"
    ></div>
    <button
      v-for="tab in tabs"
      :key="tab.id"
      :ref="el => { if (el) tabRefs[tab.id] = el }"
      :class="['tab-item', { active: modelValue === tab.id }]"
      @click="$emit('update:modelValue', tab.id)"
    >
      <component :is="tab.icon" :size="14" />
      <span>{{ tab.label }}</span>
    </button>
  </div>
</template>

<script>
export default {
  name: 'TabNav',
  props: {
    tabs: { type: Array, required: true },
    modelValue: { type: String, required: true },
  },
  emits: ['update:modelValue'],
  data() {
    return {
      tabRefs: {},
      indicatorStyle: {},
    }
  },
  watch: {
    modelValue() {
      this.$nextTick(() => this.updateIndicator())
    },
  },
  mounted() {
    this.$nextTick(() => this.updateIndicator())
    window.addEventListener('resize', this.updateIndicator)
  },
  beforeUnmount() {
    window.removeEventListener('resize', this.updateIndicator)
  },
  methods: {
    updateIndicator() {
      const activeEl = this.tabRefs[this.modelValue]
      const navEl = this.$refs.tabNavRef
      if (!activeEl || !navEl) return
      const navRect = navEl.getBoundingClientRect()
      const tabRect = activeEl.getBoundingClientRect()
      this.indicatorStyle = {
        width: `${tabRect.width}px`,
        transform: `translateX(${tabRect.left - navRect.left}px)`,
      }
    },
  },
}
</script>
