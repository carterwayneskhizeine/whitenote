import { create } from 'zustand'

// 最多记录多少条待跳转的新消息 id
const MAX_TRACKED_NEW_MESSAGES = 50

interface AppState {
    isSidebarOpen: boolean
    toggleSidebar: () => void
    isSearchOpen: boolean
    setSearchOpen: (open: boolean) => void
    // 新消息通知：记录其他设备推来的新消息 id（按到达顺序追加，最新的在末尾）
    newMessageIds: string[]
    pushNewMessage: (id: string) => void
    acknowledgeNewMessages: () => void
}

export const useAppStore = create<AppState>((set) => ({
    isSidebarOpen: false,
    toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
    isSearchOpen: false,
    setSearchOpen: (open) => set({ isSearchOpen: open }),
    newMessageIds: [],
    pushNewMessage: (id) => set((state) => {
        // 断线重连可能重复推送同一条消息，去重以免计数虚高
        if (state.newMessageIds.includes(id)) return state
        // 长时间离线时可能堆积大量 id，只保留最近的若干个
        return {
            newMessageIds: [...state.newMessageIds, id].slice(-MAX_TRACKED_NEW_MESSAGES),
        }
    }),
    acknowledgeNewMessages: () => set({ newMessageIds: [] }),
}))
