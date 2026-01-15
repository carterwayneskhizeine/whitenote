import type {
  Workspace,
  CreateWorkspaceInput,
  UpdateWorkspaceInput,
  WorkspacesResponse,
  WorkspaceResponse,
} from "@/types/api"

export const workspacesApi = {
  /**
   * 获取用户的所有 Workspace
   */
  async getWorkspaces(): Promise<WorkspacesResponse> {
    try {
      const response = await fetch("/api/workspaces")
      const data = await response.json()
      return data
    } catch (error) {
      console.error("[Workspaces API] Error fetching workspaces:", error)
      return { data: [], error: "Failed to fetch workspaces" }
    }
  },

  /**
   * 创建新 Workspace
   * 注意：创建后会自动配置 RAGFlow 资源（Dataset + Chat）
   */
  async createWorkspace(input: CreateWorkspaceInput): Promise<WorkspaceResponse> {
    try {
      const response = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      })
      const data = await response.json()
      return data
    } catch (error) {
      console.error("[Workspaces API] Error creating workspace:", error)
      return { error: "Failed to create workspace" }
    }
  },

  /**
   * 更新 Workspace
   */
  async updateWorkspace(
    id: string,
    input: UpdateWorkspaceInput
  ): Promise<WorkspaceResponse> {
    try {
      const response = await fetch(`/api/workspaces/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      })
      const data = await response.json()
      return data
    } catch (error) {
      console.error("[Workspaces API] Error updating workspace:", error)
      return { error: "Failed to update workspace" }
    }
  },

  /**
   * 删除 Workspace
   * 注意：删除后会同时删除 RAGFlow 的 Dataset 和 Chat 资源
   * 注意：不允许删除默认 Workspace
   */
  async deleteWorkspace(id: string): Promise<{ success?: boolean; error?: string }> {
    try {
      const response = await fetch(`/api/workspaces/${id}`, {
        method: "DELETE",
      })
      const data = await response.json()
      return data
    } catch (error) {
      console.error("[Workspaces API] Error deleting workspace:", error)
      return { error: "Failed to delete workspace" }
    }
  },

  /**
   * 为现有 Workspace 初始化 RAGFlow 资源
   * 用于默认工作区或其他没有 RAGFlow 资源的工作区
   */
  async initializeRAGFlow(id: string): Promise<WorkspaceResponse> {
    try {
      const response = await fetch(`/api/workspaces/${id}/initialize-ragflow`, {
        method: "POST",
      })
      const data = await response.json()
      return data
    } catch (error) {
      console.error("[Workspaces API] Error initializing RAGFlow:", error)
      return { error: "Failed to initialize RAGFlow resources" }
    }
  },
}
