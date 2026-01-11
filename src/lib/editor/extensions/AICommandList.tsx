import { Check, Sparkles } from 'lucide-react'
import * as React from 'react'
import { aiCommandsApi } from '@/lib/api'

export interface AICommandData {
  id: string
  label: string
  description: string
  action: string
}

interface AICommandListProps {
  command: (props: { content: any; action: string }) => void
}

export const AICommandList = React.forwardRef<any, AICommandListProps>(
  (props, ref) => {
    const [selectedIndex, setSelectedIndex] = React.useState(0)
    const [commands, setCommands] = React.useState<AICommandData[]>([])
    const [isLoading, setIsLoading] = React.useState(true)

    // Load commands from API
    React.useEffect(() => {
      const loadCommands = async () => {
        try {
          const result = await aiCommandsApi.getCommands()
          if (result.data) {
            setCommands(result.data)
          }
        } catch (error) {
          console.error('Failed to load AI commands:', error)
          // Fallback to default commands if API fails
          setCommands([
            {
              id: 'ask',
              label: 'Ask',
              description: 'AI Ask',
              action: 'ask',
            },
          ])
        } finally {
          setIsLoading(false)
        }
      }

      loadCommands()
    }, [])

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

    if (isLoading) {
      return (
        <div className="bg-popover text-popover-foreground border border-border rounded-lg shadow-lg p-2 min-w-[200px]">
          <div className="text-xs font-semibold text-muted-foreground px-2 py-1 mb-1">
            AI 助手
          </div>
          <div className="px-2 py-3 text-sm text-muted-foreground">
            加载中...
          </div>
        </div>
      )
    }

    return (
      <div className="bg-popover text-popover-foreground border border-border rounded-lg shadow-lg p-2 min-w-[200px] max-h-[300px] overflow-y-auto">
        <div className="text-xs font-semibold text-muted-foreground px-2 py-1 mb-1">
          AI 助手
        </div>
        {commands.map((command, index) => {
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
              <Sparkles className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
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

