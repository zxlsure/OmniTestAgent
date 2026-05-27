<template>
  <div class="chat-view">
    <div class="chat-sidebar">
      <div class="sidebar-header">
        <a-button type="primary" long @click="onNewSession">
          <template #icon><icon-plus /></template>
          新建对话
        </a-button>
      </div>
      <div class="session-list">
        <div
          v-for="session in chatStore.sessions"
          :key="session.id"
          class="session-item"
          :class="{ active: session.id === chatStore.currentSessionId }"
          @click="onSwitchSession(session.id)"
        >
          <icon-message class="session-icon" />
          <span class="session-title">{{ session.title }}</span>
          <icon-delete
            class="session-delete"
            @click.stop="onDeleteSession(session.id)"
          />
        </div>
        <a-empty v-if="!chatStore.sessions.length" description="暂无对话" />
      </div>
    </div>

    <div class="chat-main">
      <div class="agent-status-bar" v-if="chatStore.streaming">
        <a-spin :size="16" />
        <span class="status-text">{{ agentPhaseText }}</span>
        <a-button size="mini" type="text" status="danger" @click="chatStore.abortChat">中断</a-button>
      </div>

      <div class="message-area" ref="messageAreaRef">
        <a-empty v-if="!chatStore.messages.length" description="开始新的对话" />
        <div
          v-for="msg in chatStore.messages"
          :key="msg.id"
          class="message-item"
          :class="msg.role"
        >
          <div class="message-avatar">
            <a-avatar :size="32">{{ msg.role === 'user' ? 'U' : 'AI' }}</a-avatar>
          </div>
          <div class="message-body">
            <template v-if="msg.role === 'assistant'">
              <ThinkingProcess
                :thinking="msg.thinking"
                :steps="msg.thinkingSteps"
              />
              <div class="message-content" v-if="msg.content">
                <MarkdownRenderer :content="msg.content" />
              </div>
              <div class="message-meta" v-if="msg.tokenUsage">
                <span class="token-stats">Token: {{ msg.tokenUsage.prompt }} → {{ msg.tokenUsage.completion }} (共 {{ msg.tokenUsage.total }})</span>
              </div>
            </template>
            <div class="message-content" v-else>
              {{ msg.content }}
            </div>
            <div class="message-timestamp">{{ formatTimestamp(msg.timestamp) }}</div>
          </div>
        </div>
      </div>

      <div class="chat-input-area">
        <div class="llm-not-configured" v-if="!llmConfigStore.config">
          <a-alert type="warning" :closable="false">请先配置LLM服务</a-alert>
        </div>
        <div class="input-wrapper">
          <a-textarea
            v-model="inputText"
            placeholder="输入消息，/ 触发命令，Enter发送"
            :auto-size="{ minRows: 1, maxRows: 6 }"
            :disabled="chatStore.streaming"
            @keydown.enter.exact.prevent="onSend"
            @input="onInputChange"
          />
          <div class="slash-command-menu" v-if="slashCmd.showMenu.value && slashCmd.filteredCommands.value.length">
            <div
              v-for="(cmd, idx) in slashCmd.filteredCommands.value"
              :key="cmd.command"
              class="command-item"
              :class="{ selected: idx === slashCmd.selectedIndex.value }"
              @click="slashCmd.selectCommand(cmd)"
            >
              <span class="command-name">{{ cmd.command }}</span>
              <span class="command-desc">{{ cmd.description }}</span>
            </div>
          </div>
        </div>
        <a-button type="primary" :loading="chatStore.streaming" :disabled="!llmConfigStore.config" @click="onSend">
          <template #icon><icon-send /></template>
        </a-button>
      </div>

      <div class="error-bar" v-if="chatStore.error">
        <icon-close-circle class="error-icon" />
        <span>{{ chatStore.error }}</span>
        <icon-close class="error-close" @click="chatStore.error = null" />
      </div>
    </div>

    <ApprovalDialog
      :visible="!!chatStore.approvalPending"
      :tool-name="chatStore.approvalPending?.toolName || ''"
      :parameters="chatStore.approvalPending?.parameters || {}"
      @approved="onApprovalResponse(true)"
      @rejected="onApprovalResponse(false)"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, computed, onMounted, onUnmounted } from 'vue'
import { useChatStore } from '@store/useChatStore'
import { useLlmConfigStore } from '@store/useLlmConfigStore'
import { useSlashCommand } from '../composables/useSlashCommand'
import MarkdownRenderer from '../components/MarkdownRenderer.vue'
import ThinkingProcess from '../components/ThinkingProcess.vue'
import ApprovalDialog from '../components/ApprovalDialog.vue'

const chatStore = useChatStore()
const llmConfigStore = useLlmConfigStore()
const slashCmd = useSlashCommand()

const inputText = ref('')
const messageAreaRef = ref<HTMLElement | null>(null)
const lastSendContent = ref('')
const lastSendTime = ref(0)
const SEND_DEDUP_INTERVAL = 5000

const agentPhaseText = computed(() => {
  const map: Record<string, string> = {
    thinking: 'AI 正在思考...',
    tool_call: 'AI 正在调用工具...',
    result_organize: 'AI 正在整理回复...',
    done: '完成'
  }
  return map[chatStore.agentPhase || ''] || '处理中...'
})

function onNewSession() {
  const projectId = chatStore.currentSession?.projectId || ''
  chatStore.createSession(projectId || 'default')
}

async function onSwitchSession(sessionId: string) {
  chatStore.currentSessionId = sessionId
  await chatStore.fetchMessages(sessionId)
  scrollToBottom()
}

async function onDeleteSession(sessionId: string) {
  await chatStore.deleteSession(sessionId)
}

function onInputChange(value: string) {
  slashCmd.onInputChange(value)
}

async function onSend() {
  if (slashCmd.showMenu.value) {
    const confirmed = slashCmd.confirmSelection()
    if (confirmed) {
      inputText.value = slashCmd.inputText.value
      return
    }
  }
  if (!inputText.value.trim() || chatStore.streaming) return

  let content = inputText.value.trim()
  const now = Date.now()
  if (content === lastSendContent.value && (now - lastSendTime.value) < SEND_DEDUP_INTERVAL) return

  inputText.value = ''
  slashCmd.closeMenu()

  const parsed = slashCmd.parseCommand(content)
  if (parsed.isCommand && parsed.command) {
    content = `[Command: ${parsed.command.command}] ${content}`
  }

  lastSendContent.value = content
  lastSendTime.value = now

  await chatStore.sendMessage(content)
  scrollToBottom()
}

function onApprovalResponse(approved: boolean) {
  if (chatStore.approvalPending) {
    chatStore.approveToolCall(chatStore.approvalPending.toolCallId, approved)
  }
}

function formatTimestamp(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

function scrollToBottom() {
  nextTick(() => {
    if (messageAreaRef.value) {
      messageAreaRef.value.scrollTop = messageAreaRef.value.scrollHeight
    }
  })
}

onMounted(() => {
  llmConfigStore.fetchConfig()
})

onUnmounted(() => {
  chatStore.cleanupAgentEventListener()
})
</script>

<style scoped>
.chat-view { display: flex; height: calc(100vh - var(--navbar-height, 48px) - 32px); }
.chat-sidebar { width: 260px; border-right: 1px solid var(--color-border, #e5e6eb); display: flex; flex-direction: column; background: var(--color-bg-1, #fff); }
.sidebar-header { padding: 12px; }
.session-list { flex: 1; overflow-y: auto; padding: 8px; }
.session-item {
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
  transition: background 0.2s;
}
.session-item:hover, .session-item.active { background: var(--color-fill-2, #e5e6eb); }
.session-icon { font-size: 16px; color: var(--color-text-3, #86909c); }
.session-title { flex: 1; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.session-delete { font-size: 14px; color: var(--color-text-4, #c9cdd4); opacity: 0; transition: opacity 0.2s; }
.session-item:hover .session-delete { opacity: 1; }
.session-delete:hover { color: var(--color-danger, #f53f3f); }

.chat-main { flex: 1; display: flex; flex-direction: column; min-width: 0; }

.agent-status-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  background: var(--color-primary-light-1, #e8f3ff);
  border-bottom: 1px solid var(--color-border, #e5e6eb);
  font-size: 13px;
}
.status-text { color: var(--color-primary, #165dff); flex: 1; }

.message-area { flex: 1; overflow-y: auto; padding: 16px; }
.message-item { display: flex; gap: 12px; margin-bottom: 20px; }
.message-item.user { flex-direction: row-reverse; }
.message-body { max-width: 75%; min-width: 0; }
.message-content {
  padding: 10px 14px;
  border-radius: 8px;
  background: var(--color-fill-1, #f7f8fa);
  font-size: 14px;
  line-height: 1.6;
  word-break: break-word;
}
.message-item.user .message-content {
  background: var(--color-primary, #165dff);
  color: #fff;
}
.message-meta { font-size: 11px; color: var(--color-text-3, #86909c); margin-top: 2px; }
.token-stats { font-family: monospace; }
.message-timestamp { font-size: 11px; color: var(--color-text-4, #c9cdd4); margin-top: 2px; }

.chat-input-area {
  padding: 12px;
  border-top: 1px solid var(--color-border, #e5e6eb);
  display: flex;
  gap: 8px;
  align-items: flex-end;
  position: relative;
}
.input-wrapper { flex: 1; position: relative; }
.slash-command-menu {
  position: absolute;
  bottom: 100%;
  left: 0;
  background: var(--color-bg-2, #fff);
  border: 1px solid var(--color-border, #e5e6eb);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  padding: 4px;
  min-width: 260px;
  z-index: 100;
  margin-bottom: 4px;
}
.command-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}
.command-item:hover, .command-item.selected { background: var(--color-fill-2, #e5e6eb); }
.command-name { font-weight: 500; color: var(--color-primary, #165dff); white-space: nowrap; }
.command-desc { color: var(--color-text-3, #86909c); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.error-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 16px;
  background: var(--color-danger-light-1, #ffece8);
  font-size: 13px;
  color: var(--color-danger, #f53f3f);
}
.error-icon { font-size: 16px; }
.error-close { margin-left: auto; cursor: pointer; font-size: 14px; }
.error-close:hover { opacity: 0.7; }
</style>
