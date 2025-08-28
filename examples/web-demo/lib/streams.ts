// Shared stream storage between API routes
// Use globalThis to persist across hot reloads in development
const globalStreams = globalThis as any
if (!globalStreams.activeStreams) {
  globalStreams.activeStreams = new Map<string, { streamId: string, controller: ReadableStreamDefaultController }>()
}
export const activeStreams = globalStreams.activeStreams

export function broadcastToStream(streamId: string, data: any) {
  const stream = activeStreams.get(streamId)
  if (stream?.controller) {
    try {
      const message = `data: ${JSON.stringify(data)}\n\n`
      stream.controller.enqueue(message)
    } catch (error) {
      console.error('[broadcastToStream] Failed to send to stream:', error)
    }
  } else {
    console.error(`[broadcastToStream] No active stream found for streamId: ${streamId}`)
  }
}