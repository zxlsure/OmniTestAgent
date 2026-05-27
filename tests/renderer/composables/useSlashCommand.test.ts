// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { SLASH_COMMANDS, useSlashCommand } from '@/features/chat/composables/useSlashCommand'

describe('SLASH_COMMANDS', () => {
  it('4个斜杠命令定义存在', () => {
    expect(SLASH_COMMANDS).toHaveLength(4)
    const names = SLASH_COMMANDS.map(c => c.command)
    expect(names).toContain('/analyze')
    expect(names).toContain('/design')
    expect(names).toContain('/cases')
    expect(names).toContain('/script')
  })

  it('每个命令都有必要属性', () => {
    for (const cmd of SLASH_COMMANDS) {
      expect(cmd.command).toMatch(/^\//)
      expect(cmd.label).toBeTruthy()
      expect(cmd.description).toBeTruthy()
      expect(cmd.icon).toBeTruthy()
      expect(cmd.mappedTool).toBeTruthy()
    }
  })
})

describe('useSlashCommand', () => {
  const composable = useSlashCommand()

  it('filterCommands("/") 返回4个命令（输入 / 后显示全部）', () => {
    composable.onInputChange('/')
    expect(composable.showMenu.value).toBe(true)
    expect(composable.filteredCommands.value).toHaveLength(4)
  })

  it('filterCommands("/a") 返回匹配 /analyze 的命令', () => {
    composable.onInputChange('/a')
    expect(composable.showMenu.value).toBe(true)
    const commands = composable.filteredCommands.value
    const matchedNames = commands.map(c => c.command)
    expect(matchedNames).toContain('/analyze')
  })

  it('parseCommand("/analyze 需求文档") 返回正确的命令和参数', () => {
    const result = composable.parseCommand('/analyze 需求文档')
    expect(result.isCommand).toBe(true)
    expect(result.command?.command).toBe('/analyze')
    expect(result.args).toBe('需求文档')
  })

  it('parseCommand("普通消息") 返回 isCommand=false', () => {
    const result = composable.parseCommand('普通消息')
    expect(result.isCommand).toBe(false)
  })

  it('parseCommand("/unknown") 返回 isCommand=false', () => {
    const result = composable.parseCommand('/unknown')
    expect(result.isCommand).toBe(false)
  })

  it('parseCommand("/design") 无参数时 args 为 undefined', () => {
    const result = composable.parseCommand('/design')
    expect(result.isCommand).toBe(true)
    expect(result.command?.command).toBe('/design')
    expect(result.args).toBeUndefined()
  })

  it('toToolCallDescription 正确转换', () => {
    const desc = composable.toToolCallDescription('/analyze 登录模块')
    expect(desc).toContain('需求分析')
    expect(desc).toContain('analyze_requirement')
    expect(desc).toContain('登录模块')
  })

  it('selectCommand 更新 inputText', () => {
    composable.onInputChange('/')
    composable.selectCommand(SLASH_COMMANDS[0])
    expect(composable.inputText.value).toBe('/analyze ')
    expect(composable.showMenu.value).toBe(false)
  })
})

describe('斜杠命令映射联动', () => {
  const composable = useSlashCommand()

  it('/analyze → analyze_requirement', () => {
    const result = composable.parseCommand('/analyze')
    expect(result.isCommand).toBe(true)
    expect(result.command?.mappedTool).toBe('analyze_requirement')
  })

  it('/design → design_test', () => {
    const result = composable.parseCommand('/design')
    expect(result.isCommand).toBe(true)
    expect(result.command?.mappedTool).toBe('design_test')
  })

  it('/cases → generate_cases', () => {
    const result = composable.parseCommand('/cases')
    expect(result.isCommand).toBe(true)
    expect(result.command?.mappedTool).toBe('generate_cases')
  })

  it('/script → generate_script', () => {
    const result = composable.parseCommand('/script')
    expect(result.isCommand).toBe(true)
    expect(result.command?.mappedTool).toBe('generate_script')
  })

  it('SLASH_COMMANDS完整性校验-4个命令全部有mappedTool', () => {
    const toolNames = ['analyze_requirement', 'design_test', 'generate_cases', 'generate_script']
    for (const cmd of SLASH_COMMANDS) {
      expect(cmd.mappedTool).toBeTruthy()
      expect(toolNames).toContain(cmd.mappedTool)
    }
    expect(SLASH_COMMANDS).toHaveLength(4)
  })
})
