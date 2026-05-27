import { Message } from '@arco-design/web-vue'

export function useNotification() {
  function success(content: string) { Message.success(content) }
  function error(content: string) { Message.error(content) }
  function warning(content: string) { Message.warning(content) }
  function info(content: string) { Message.info(content) }
  return { success, error, warning, info }
}
