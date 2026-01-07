import { Check, Sparkles, Languages, FileText, Wand2 } from 'lucide-react'
import * as React from 'react'

export interface AICommand {
  id: string
  label: string
  description: string
  icon: React.ElementType
  action: string
}

const commands: AICommand[] = [
  {
    id: 'summarize',
    label: '总结',
    description: '总结内容的要点',
    icon: FileText,
    action: 'summarize',
  },
  {
    id: 'translate',
    label: '翻译',
    description: '翻译成其他语言',
    icon: Languages,
    action: 'translate',
  },
  {
    id: 'expand',
    label: '扩展',
    description: '扩展内容使其更完整',
    icon: Sparkles,
    action: 'expand',
  },
  {
    id: 'polish',
    label: '润色',
    description: '润色文字使其更专业',
    icon: Wand2,
    action: 'polish',
  },
]

interface AICommandListProps {
  command: (props: { content: any; action: string }) => void
}

export const AICommandList = React.forwardRef<any, AICommandListProps>(
  (props, ref) => {
    const [selectedIndex, setSelectedIndex] = React.useState(0)

    React.useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: { event: KeyboardEvent }) => {
        if (event.key === 'ArrowUp') {
          setSelectedIndex((selectedIndex + commands.length - 1) % commands.length)
          return true
        }
        if (event.key === 'ArrowDown') {
          setSelectedIndex((selectedIndex + 1) % commands.length)
          return true
        }
        if (event.key === 'Enter') {
          selectItem(selectedIndex)
          return true
        }
        return false
      },
    }))

    const selectItem = (index: number) => {
      const command = commands[index]
      props.command({
        content: {
          type: 'text',
          text: '',
        },
        action: command.action,
      })
    }

    return (
      <div className="bg-popover text-popover-foreground border border-border rounded-lg shadow-lg p-2 min-w-[200px] max-h-[300px] overflow-y-auto">
        <div className="text-xs font-semibold text-muted-foreground px-2 py-1 mb-1">
          AI 助手
        </div>
        {commands.map((command, index) => {
          const Icon = command.icon
          const isSelected = index === selectedIndex

          return (
            <button
              key={command.id}
              className={`w-full flex items-start gap-3 px-2 py-2 rounded-md text-sm text-left transition-colors ${
                isSelected
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-accent/50'
              }`}
              onClick={() => selectItem(index)}
            >
              <Icon className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="font-medium">{command.label}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {command.description}
                </div>
              </div>
              {isSelected && (
                <Check className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
            </button>
          )
        })}
      </div>
    )
  }
)

AICommandList.displayName = 'AICommandList'

export { commands }
