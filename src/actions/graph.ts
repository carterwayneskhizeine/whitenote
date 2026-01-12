
import prisma from "@/lib/prisma"
import { GraphData, GraphNode, GraphLink } from '@/types/graph'

export async function getGraphData(): Promise<GraphData> {
    // Fetch all messages with their relationships
    const messages = await prisma.message.findMany({
        select: {
            id: true,
            title: true,
            content: true,
            parentId: true,
            quotedMessageId: true,
            quotedCommentId: true,
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
                    children: true,
                    retweets: true,
                    comments: true
                }
            }
        }
    })

    // Fetch all comments with their relationships
    const comments = await prisma.comment.findMany({
        select: {
            id: true,
            content: true,
            messageId: true,
            parentId: true,
            quotedMessageId: true,
            isStarred: true,
            _count: {
                select: {
                    replies: true,
                    retweets: true
                }
            }
        }
    })

    // Create Message nodes
    const messageNodes: GraphNode[] = messages.map((msg) => {
        const primaryTag = msg.tags[0]?.tag
        const connections =
            msg._count.children +
            msg._count.retweets +
            msg._count.comments

        return {
            id: msg.id,
            title: msg.title || msg.content.substring(0, 30),
            group: primaryTag?.name || 'Unknown',
            val: connections + 1,
            isHub: connections > 3,
            color: primaryTag?.color || '#5c5c5c',
            nodeType: 'message'
        }
    })

    // Create Comment nodes
    const commentNodes: GraphNode[] = comments.map((comment) => {
        const connections = comment._count.replies + comment._count.retweets

        return {
            id: comment.id,
            title: comment.content.substring(0, 30),
            group: 'Comment',
            val: connections + 1,
            isHub: connections > 2,
            color: comment.isStarred ? '#f59e0b' : '#6b7280',
            nodeType: 'comment'
        }
    })

    // Combine all nodes
    const nodes: GraphNode[] = [...messageNodes, ...commentNodes]

    // Create links
    const links: GraphLink[] = []
    const messageIds = new Set(messages.map(m => m.id))
    const commentIds = new Set(comments.map(c => c.id))

    // 1. Comment → Message relationships (comments on messages)
    comments.forEach((comment) => {
        if (comment.messageId && messageIds.has(comment.messageId)) {
            links.push({
                source: comment.messageId,
                target: comment.id,
                value: 1,
                type: 'comment'
            } as unknown as GraphLink)
        }
    })

    // 2. Comment → Comment relationships (nested replies)
    comments.forEach((comment) => {
        if (comment.parentId && commentIds.has(comment.parentId)) {
            links.push({
                source: comment.parentId,
                target: comment.id,
                value: 1,
                type: 'comment-reply'
            } as unknown as GraphLink)
        }
    })

    // 3. Message → Message relationships (quotes)
    messages.forEach((msg) => {
        if (msg.quotedMessageId && messageIds.has(msg.quotedMessageId)) {
            links.push({
                source: msg.quotedMessageId,
                target: msg.id,
                value: 1,
                type: 'quote'
            } as unknown as GraphLink)
        }
    })

    // 4. Message → Comment relationships (message quotes comment)
    messages.forEach((msg) => {
        if (msg.quotedCommentId && commentIds.has(msg.quotedCommentId)) {
            links.push({
                source: msg.quotedCommentId,
                target: msg.id,
                value: 1,
                type: 'quote'
            } as unknown as GraphLink)
        }
    })

    // 6. Retweet counts (affects node size)
    const messageRetweets = await prisma.retweet.findMany({
        where: { messageId: { not: null } },
        select: { messageId: true }
    })

    const commentRetweets = await prisma.retweet.findMany({
        where: { commentId: { not: null } },
        select: { commentId: true }
    })

    // Count retweets per node
    const retweetCounts = new Map<string, number>()

    messageRetweets.forEach((retweet) => {
        if (retweet.messageId) {
            retweetCounts.set(
                retweet.messageId,
                (retweetCounts.get(retweet.messageId) || 0) + 1
            )
        }
    })

    commentRetweets.forEach((retweet) => {
        if (retweet.commentId) {
            retweetCounts.set(
                retweet.commentId,
                (retweetCounts.get(retweet.commentId) || 0) + 1
            )
        }
    })

    // Update node values based on retweet counts
    nodes.forEach((node) => {
        const retweetCount = retweetCounts.get(node.id) || 0
        if (retweetCount > 0) {
            node.val += retweetCount * 2
        }
    })

    return { nodes, links }
}
