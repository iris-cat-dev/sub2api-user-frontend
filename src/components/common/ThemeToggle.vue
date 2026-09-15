<template>
  <button
    type="button"
    class="theme-toggle"
    :aria-label="label"
    :title="label"
    :aria-pressed="isDark"
    @click="appStore.toggleTheme()"
  >
    <span class="theme-toggle__track" aria-hidden="true">
      <span class="theme-toggle__thumb">
        <Icon :name="isDark ? 'moon' : 'sun'" size="sm" />
      </span>
    </span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import { useAppStore } from '@/stores/app'

const { t } = useI18n()
const appStore = useAppStore()
const isDark = computed(() => appStore.isDark)
const label = computed(() => t(isDark.value ? 'nav.lightMode' : 'nav.darkMode'))
</script>

<style scoped>
.theme-toggle {
  display: inline-flex;
  min-width: 2.75rem;
  height: 2.25rem;
  align-items: center;
  justify-content: center;
  border-radius: 0.65rem;
  color: #52617a;
  transition: background 160ms ease, color 160ms ease;
}
.theme-toggle:hover { background: #eef2ff; color: #7c3aed; }
.theme-toggle__track {
  position: relative;
  display: block;
  width: 2.25rem;
  height: 1.25rem;
  border: 1px solid #d6dbea;
  border-radius: 999px;
  background: #e9edf6;
}
.theme-toggle__thumb {
  position: absolute;
  top: 1px;
  left: 1px;
  display: flex;
  width: 1rem;
  height: 1rem;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: #ffffff;
  color: #f59e0b;
  box-shadow: 0 1px 4px rgba(30, 41, 59, 0.18);
  transition: transform 180ms ease, background 180ms ease, color 180ms ease;
}
:global(.dark .theme-toggle) { color: #9aa8cb; }
:global(.dark .theme-toggle:hover) { background: #111d3d; color: #f0abfc; }
:global(.dark .theme-toggle__track) { border-color: #2a3963; background: #111d3d; }
:global(.dark .theme-toggle__thumb) { transform: translateX(1rem); background: #6d5dfc; color: #ffffff; }
</style>
