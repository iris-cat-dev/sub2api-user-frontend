<template>
  <div class="flex items-center gap-1">
    <span :class="['max-w-[72px] shrink-0 truncate rounded px-1 text-left text-[10px] font-medium', labelClass]" :title="title">
      {{ label }}
    </span>
    <div class="h-1.5 w-8 shrink-0 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
      <div class="h-full rounded-full transition-all" :class="barClass" :style="{ width: barWidth }" />
    </div>
    <span :class="['w-8 shrink-0 text-right text-[10px] font-medium', textClass]">{{ displayPercent }}</span>
    <span v-if="resetsAt" class="shrink-0 text-[10px] text-gray-400">{{ resetCountdown }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useIntervalFn } from '@vueuse/core'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  label: string
  title?: string
  utilization: number
  resetsAt?: string | null
  color: 'indigo' | 'emerald' | 'purple' | 'amber'
}>()
const { t } = useI18n()
const now = ref(Date.now())
const clock = useIntervalFn(() => {
  now.value = Date.now()
}, 60_000, { immediate: false })

if (props.resetsAt) clock.resume()
watch(() => props.resetsAt, (value) => {
  if (value) {
    now.value = Date.now()
    clock.resume()
  } else {
    clock.pause()
  }
})

const labelClass = computed(() => ({
  indigo: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
})[props.color])
const barClass = computed(() => {
  if (props.utilization >= 90) return 'bg-red-500'
  if (props.utilization >= 75) return 'bg-amber-500'
  return 'bg-green-500'
})
const textClass = computed(() => {
  if (props.utilization >= 90) return 'text-red-600 dark:text-red-400'
  if (props.utilization >= 75) return 'text-amber-600 dark:text-amber-400'
  return 'text-gray-600 dark:text-gray-400'
})
const barWidth = computed(() => `${Math.min(Math.max(props.utilization, 0), 100)}%`)
const displayPercent = computed(() => {
  const percent = Math.round(props.utilization)
  return percent > 999 ? '>999%' : `${percent}%`
})
const resetCountdown = computed(() => {
  if (!props.resetsAt) return ''
  const remaining = new Date(props.resetsAt).getTime() - now.value
  if (remaining <= 0) return props.utilization > 0 ? t('usage.resetPending') : t('usage.resetNow')
  const hours = Math.floor(remaining / 3_600_000)
  const minutes = Math.floor((remaining % 3_600_000) / 60_000)
  if (hours >= 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
})
</script>
