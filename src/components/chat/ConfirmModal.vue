<!--
  Component: ConfirmModal
  说明: 可重用的确认模态框，支持可选取消按钮、不同风格的确认按钮（例如 danger）。
  Props: `show`, `title`, `message`, `confirmText`, `confirmVariant`。
  事件: `confirm` / `cancel`。
-->
<script setup lang="ts">
interface Props {
  show: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  confirmVariant?: 'primary' | 'danger'
  showCancel?: boolean
}

withDefaults(defineProps<Props>(), {
  confirmText: '确定',
  cancelText: '取消',
  confirmVariant: 'primary',
  showCancel: true,
})

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="modal-overlay" @click="emit('cancel')">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h3>{{ title }}</h3>
        </div>
        <div class="modal-body">
          <p>{{ message }}</p>
        </div>
        <div class="modal-footer">
          <button v-if="showCancel" type="button" class="btn-cancel" @click="emit('cancel')">
            {{ cancelText }}
          </button>
          <button
            type="button"
            :class="confirmVariant === 'danger' ? 'btn-danger' : 'btn-primary'"
            @click="emit('confirm')"
          >
            {{ confirmText }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.modal {
  background: var(--surface);
  border-radius: 1rem;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  max-width: 400px;
  width: 90%;
  overflow: hidden;
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.modal-header {
  padding: 1.5rem 1.5rem 1rem;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.modal-body {
  padding: 1rem 1.5rem 1.5rem;
}

.modal-body p {
  margin: 0;
  line-height: 1.6;
  color: var(--text-primary);
}

.modal-footer {
  padding: 1rem 1.5rem;
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  background: var(--surface);
}

.btn-cancel,
.btn-danger,
.btn-primary {
  padding: 0.5rem 1.25rem;
  border-radius: 0.6rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
  font-size: 0.95rem;
}

.btn-cancel {
  background: transparent;
  color: var(--text-primary);
  border: 1px solid var(--border);
}

.btn-cancel:hover {
  background: var(--surface-alt);
}

.btn-danger {
  background: var(--danger);
  color: white;
}

.btn-danger:hover {
  background: #dc2626;
}

.btn-danger:active {
  background: #b91c1c;
}

.btn-primary {
  background: var(--primary);
  color: white;
}

.btn-primary:hover {
  background: #1d4ed8;
}

.btn-primary:active {
  background: #1e40af;
}
</style>
