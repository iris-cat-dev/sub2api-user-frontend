<template>
  <AppLayout>
    <ChatWorkspace v-if="authStore.user" :key="authStore.user.id" :user-id="authStore.user.id" />
  </AppLayout>
</template>

<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'
import AppLayout from '@/components/layout/AppLayout.vue'
import ChatWorkspace from '@/features/chat/ChatWorkspace.vue'

const authStore = useAuthStore()
</script>
