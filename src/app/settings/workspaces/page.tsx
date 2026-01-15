"use client"

import { WorkspaceManager } from "@/components/WorkspaceManager"

export default function WorkspacesSettingsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">工作区管理</h1>
          <p className="text-muted-foreground mt-2">
            创建和管理您的工作区，每个工作区有独立的知识库和设置
          </p>
        </div>
        <WorkspaceManager />
      </div>
    </div>
  )
}
