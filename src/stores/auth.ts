/*
  Store: auth
  说明: 简单的演示用用户状态（本示例为 Demo 用户），提供用户名与头像颜色。
  注意: 在真实应用中应替换为真正的身份认证逻辑。
*/
import { defineStore } from 'pinia'

interface AuthState {
  userId: string
  username: string
  avatarColor: string
}

const palette = ['#6366f1', '#0ea5e9', '#22c55e', '#f97316']

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    userId: 'demo-user',
    username: '访客',
    avatarColor: palette[Math.floor(Math.random() * palette.length)]!,
  }),
  actions: {
    setUsername(name: string) {
      this.username = name
    },
  },
  getters: {
    initials: state => state.username.slice(0, 1).toUpperCase(),
  },
})
