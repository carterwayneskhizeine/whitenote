import { Extension } from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'
import { ReactRenderer } from '@tiptap/react'
import tippy from 'tippy.js'
import 'tippy.js/animations/scale.css'
import 'tippy.js/themes/light.css'
import { TemplateList } from './TemplateList'

interface SlashCommandOptions {
  onTemplateSelect: (template: any, editor: any) => void
}

export const SlashCommand = Extension.create<SlashCommandOptions>({
  name: 'slashCommand',

  addOptions() {
    return {
      onTemplateSelect: () => {},
    }
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        char: '/',
        items: ({ query }) => {
          // Return empty array as filtering is now done inside AICommandList
          return []
        },
        render: () => {
          let component: any
          let popup: any

          return {
            onStart: (props: any) => {
              component = new ReactRenderer(TemplateList, {
                props: {
                  command: (commandProps: any) => {
                    this.options.onTemplateSelect(commandProps.template, props.editor)
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
