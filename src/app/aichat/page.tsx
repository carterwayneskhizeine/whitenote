import { ChatWindow } from "@/components/OpenClawChat/ChatWindow"

export default function AIChatPage() {
  return (
    <div className="container mx-auto max-w-4xl py-6">
      <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b px-4 py-3 mb-4">
        <h1 className="text-2xl font-bold">AI Chat</h1>
        <p className="text-sm text-muted-foreground">Powered by OpenClaw</p>
      </div>
      <div className="border rounded-lg bg-card">
        <ChatWindow />
      </div>
    </div>
  )
}
