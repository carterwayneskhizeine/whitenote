import { Check } from 'lucide-react'
import * as React from 'react'
import { templatesApi } from '@/lib/api/templates'

export interface TemplateData {
  id: string
  name: string
  content: string
}

interface TemplateListProps {
  command: (props: { content: any; template: any }) => void
}

export const TemplateList = React.forwardRef<any, TemplateListProps>(
  (props, ref) => {
    const [selectedIndex, setSelectedIndex] = React.useState(0)
    const [templates, setTemplates] = React.useState<TemplateData[]>([])
    const [isLoading, setIsLoading] = React.useState(true)

    // Load templates from API
    React.useEffect(() => {
      const loadTemplates = async () => {
        try {
          const result = await templatesApi.getTemplates()
          if (result.data) {
            setTemplates(result.data)
          }
        } catch (error) {
          console.error('Failed to load templates:', error)
        } finally {
          setIsLoading(false)
        }
      }

      loadTemplates()
    }, [])

    React.useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: { event: KeyboardEvent }) => {
        if (event.key === 'ArrowUp') {
          setSelectedIndex((selectedIndex + templates.length - 1) % templates.length)
          return true
        }
        if (event.key === 'ArrowDown') {
          setSelectedIndex((selectedIndex + 1) % templates.length)
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
      const template = templates[index]
      props.command({
        content: {
          type: 'text',
          text: '',
        },
        template,
      })
    }

    if (isLoading) {
      return (
        <div className="bg-popover text-popover-foreground border border-border rounded-lg shadow-lg p-2 min-w-[200px]">
          <div className="px-2 py-3 text-sm text-muted-foreground">
            加载中...
          </div>
        </div>
      )
    }

    if (templates.length === 0) {
      return (
        <div className="bg-popover text-popover-foreground border border-border rounded-lg shadow-lg p-2 min-w-[200px]">
          <div className="px-2 py-3 text-sm text-muted-foreground">
            暂无模板
          </div>
        </div>
      )
    }

    return (
      <div className="bg-popover text-popover-foreground border border-border rounded-lg shadow-lg p-2 min-w-[200px] max-h-[300px] overflow-y-auto">
        {templates.map((template, index) => {
          const isSelected = index === selectedIndex

          return (
            <button
              key={template.id}
              className={`w-full flex items-start gap-3 px-2 py-2 rounded-md text-sm text-left transition-colors ${
                isSelected
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-accent/50'
              }`}
              onClick={() => selectItem(index)}
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium">{template.name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {template.content.slice(0, 50)}...
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

TemplateList.displayName = 'TemplateList'
