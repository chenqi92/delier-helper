<template>
  <div class="app-body">
    <div class="empty-state" style="flex:1;">
      <Database :size="48" style="opacity:0.3;margin-bottom:16px;" />
      <p>数据库文档生成器</p>
      <p class="hint">🚧 功能开发中，敬请期待...</p>
    </div>
  </div>
</template>

<script>
import { Database } from 'lucide-vue-next'

export default {
  name: 'DbDocGenerator',
  components: { Database },
}
</script>
