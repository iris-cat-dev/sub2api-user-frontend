<template>
  <AppLayout>
    <DrawingWorkspace v-if="authStore.user" :user-id="authStore.user.id" embedded />
  </AppLayout>
</template>

<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'
import AppLayout from '@/components/layout/AppLayout.vue'
import DrawingWorkspace from '@/features/drawing/DrawingWorkspace.vue'

const authStore = useAuthStore()
</script>
