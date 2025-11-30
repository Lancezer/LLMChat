import { createRouter, createWebHistory } from 'vue-router'

const ChatPage = () => import('@/views/ChatPage.vue')

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/:sessionId?',
      name: 'chat',
      component: ChatPage,
    },
  ],
})

export default router
