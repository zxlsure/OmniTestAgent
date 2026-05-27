import { ref, computed, watch } from 'vue'

export interface SlashCommand {
  command: string
  label: string
  description: string
  icon: string
  mappedTool: string
  prerequisite?: string
}

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    command: '/analyze',
    label: '需求分析',
    description: '分析需求文档，提取测试点',
    icon: 'icon-search',
    mappedTool: 'analyze_requirement',
    prerequisite: '需求文档已导入'
  },
  {
    command: '/design',
    label: '测试设计',
    description: '设计测试方案和策略',
    icon: 'icon-design',
    mappedTool: 'design_test',
    prerequisite: '需求分析已完成'
  },
  {
    command: '/cases',
    label: '用例生成',
    description: '生成测试用例',
    icon: 'icon-file-text',
    mappedTool: 'generate_cases',
    prerequisite: '测试设计已完成'
  },
  {
    command: '/script',
    label: '脚本生成',
    description: '生成自动化测试脚本',
    icon: 'icon-code',
    mappedTool: 'generate_script',
    prerequisite: '用例设计已完成'
  }
]

export function useSlashCommand() {
  const inputText = ref('')
  const showMenu = ref(false)
  const filterText = ref('')
  const selectedIndex = ref(0)

  const filteredCommands = computed(() => {
    if (!filterText.value) return SLASH_COMMANDS
    return SLASH_COMMANDS.filter(cmd =>
      cmd.command.includes(filterText.value) ||
      cmd.label.includes(filterText.value) ||
      cmd.description.includes(filterText.value)
    )
  })

  function onInputChange(value: string) {
    inputText.value = value
    const lastSlash = value.lastIndexOf('/')
    if (lastSlash >= 0) {
      const afterSlash = value.slice(lastSlash + 1)
      if (!afterSlash.includes(' ') && /^[a-zA-Z]*$/.test(afterSlash)) {
        filterText.value = afterSlash
        showMenu.value = true
        selectedIndex.value = 0
        return
      }
    }
    showMenu.value = false
  }

  function selectCommand(cmd: SlashCommand) {
    const lastSlash = inputText.value.lastIndexOf('/')
    if (lastSlash >= 0) {
      inputText.value = inputText.value.slice(0, lastSlash) + cmd.command + ' '
    } else {
      inputText.value = cmd.command + ' '
    }
    showMenu.value = false
  }

  function navigateUp() {
    if (selectedIndex.value > 0) selectedIndex.value--
  }

  function navigateDown() {
    if (selectedIndex.value < filteredCommands.value.length - 1) selectedIndex.value++
  }

  function confirmSelection(): boolean {
    if (showMenu.value && filteredCommands.value.length > 0) {
      selectCommand(filteredCommands.value[selectedIndex.value])
      return true
    }
    return false
  }

  function closeMenu() {
    showMenu.value = false
  }

  function parseCommand(input: string): { isCommand: boolean; command?: SlashCommand; args?: string } {
    const trimmed = input.trim()
    const match = trimmed.match(/^\/(\w+)(?:\s+(.*))?$/)
    if (!match) return { isCommand: false }

    const cmd = SLASH_COMMANDS.find(c => c.command === `/${match[1]}`)
    if (!cmd) return { isCommand: false }

    return {
      isCommand: true,
      command: cmd,
      args: match[2]?.trim()
    }
  }

  function toToolCallDescription(input: string): string {
    const parsed = parseCommand(input)
    if (!parsed.isCommand || !parsed.command) return input
    const argsText = parsed.args ? `，参数: ${parsed.args}` : ''
    return `执行${parsed.command.label}（工具: ${parsed.command.mappedTool}）${argsText}`
  }

  return {
    inputText,
    showMenu,
    filterText,
    selectedIndex,
    filteredCommands,
    onInputChange,
    selectCommand,
    navigateUp,
    navigateDown,
    confirmSelection,
    closeMenu,
    parseCommand,
    toToolCallDescription,
    SLASH_COMMANDS
  }
}
