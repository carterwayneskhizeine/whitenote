import { SearchParams, SearchResponse } from '@/types/api'

const API_BASE = '/api'

export const searchApi = {
  /**
   * Global search
   */
  async search(params: SearchParams): Promise<SearchResponse> {
    const searchParams = new URLSearchParams()
    searchParams.set('q', params.q)
    if (params.page) searchParams.set('page', params.page.toString())
    if (params.limit) searchParams.set('limit', params.limit.toString())

    const response = await fetch(
      `${API_BASE}/search?${searchParams.toString()}`
    )
    return response.json()
  },
}
