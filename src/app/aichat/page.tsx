import { ChatWindow } from "@/components/OpenClawChat/ChatWindow"

export default function AIChatPage() {
  return (
    <div className="flex flex-col h-[100dvh] desktop:h-screen">
      <div className="shrink-0 border-b px-4 py-3 desktop:pt-26.5 desktop:pb-3 bg-background desktop:bg-transparent z-50 desktop:z-0 fixed desktop:relative top-0 left-0 right-0">
        <h1 className="text-xl font-bold">AI Chat</h1>
      </div>
      <ChatWindow />
    </div>
  )
}
