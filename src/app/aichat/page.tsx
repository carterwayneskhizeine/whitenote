import { ChatWindow } from "@/components/OpenClawChat/ChatWindow"

export default function AIChatPage() {
  return (
    <div className="flex flex-col min-h-screen pt-26.5 desktop:pt-0">
      <div className="border-b px-4 py-3">
        <h1 className="text-xl font-bold">AI Chat</h1>
        <p className="text-sm text-muted-foreground">Powered by OpenClaw</p>
      </div>
      <ChatWindow />
    </div>
  )
}
