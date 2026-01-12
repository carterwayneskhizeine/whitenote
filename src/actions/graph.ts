
import prisma from "@/lib/prisma"
import { GraphData, GraphNode, GraphLink } from '@/types/graph'

export async function getGraphData(): Promise<GraphData> {
    const messages = await prisma.message.findMany({
        select: {
            id: true,
            title: true,
            content: true,
            parentId: true,
            tags: {
                select: {
                    tag: {
                        select: {
                            name: true,
                            color: true
                        }
                    }
                },
                take: 1
            },
            _count: {
                select: {
                    children: true
                }
            }
        }
    })

    // Transform to nodes
    const nodes: GraphNode[] = messages.map((msg) => {
        const primaryTag = msg.tags[0]?.tag
        const isHub = msg._count.children > 2 || !msg.parentId

        return {
            id: msg.id,
            title: msg.title || msg.content.substring(0, 20),
            group: primaryTag?.name || 'Unknown',
            val: msg._count.children + 1,
            isHub: isHub,
            color: primaryTag?.color || '#5c5c5c',
        }
    })

    // Transform to links
    const links: GraphLink[] = []
    const messageIds = new Set(messages.map(m => m.id))

    messages.forEach((msg) => {
        if (msg.parentId && messageIds.has(msg.parentId)) {
            links.push({
                source: msg.parentId,
                target: msg.id,
                value: 1
            } as unknown as GraphLink)
        }
    })

    return { nodes, links }
}
