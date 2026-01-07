import { Extension } from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'
import { ReactRenderer } from '@tiptap/react'
import tippy from 'tippy.js'
import 'tippy.js/animations/scale.css'
import 'tippy.js/themes/light.css'
import { AICommandList, commands } from './AICommandList'

interface SlashCommandOptions {
  onCommandSelect: (action: string, editor: any) => void
}

export const SlashCommand = Extension.create<SlashCommandOptions>({
  name: 'slashCommand',

  addOptions() {
    return {
      onCommandSelect: () => {},
    }
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        char: '/',
        items: ({ query }) => {
          return commands.filter((item) =>
            item.label.toLowerCase().includes(query.toLowerCase())
          )
        },
        render: () => {
          let component: any
          let popup: any

          return {
            onStart: (props: any) => {
              component = new ReactRenderer(AICommandList, {
                props: {
                  command: (commandProps: any) => {
                    this.options.onCommandSelect(commandProps.action, props.editor)
                    // Delete the "/" character
                    props.editor.view.dispatch(
                      props.editor.state.tr.deleteRange(
                        props.range.from,
                        props.range.to
                      )
                    )
                  },
                },
                editor: props.editor,
              })

              popup = tippy('body', {
                getReferenceClientRect: props.clientRect,
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: 'manual',
                placement: 'bottom-start',
              })
            },

            onUpdate(props: any) {
              component.updateProps(props)

              if (props.clientRect) {
                popup[0].setProps({
                  getReferenceClientRect: props.clientRect,
                })
              }
            },

            onKeyDown(props: any) {
              if (props.event.key === 'Escape') {
                popup[0].hide()
                return true
              }

              return component.ref?.onKeyDown(props)
            },

            onExit() {
              popup[0].destroy()
              component.destroy()
            },
          }
        },
      }),
    ]
  },
})
