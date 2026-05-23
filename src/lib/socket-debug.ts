/**
 * Socket debugging utilities
 * STEP 9-10: Verify socket connection, auth, and rooms
 */

export function getSocketDebugInfo() {
  try {
    // Try to access socket through window for debugging
    const info: any = {
      timestamp: new Date().toISOString(),
      connected: false,
      socketId: null,
      role: null,
      rooms: [],
      transport: null,
      errors: [],
    }

    // Check if socket.io client is available
    const socketIoClient = (window as any).io
    if (!socketIoClient) {
      info.errors.push('Socket.io client not loaded')
      return info
    }

    console.log('[SOCKET_DEBUG] Socket.io client available')
    return info
  } catch (err) {
    return {
      timestamp: new Date().toISOString(),
      connected: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}

export function logSocketStatus(context: string) {
  const info = getSocketDebugInfo()
  console.log(`[SOCKET_STATUS] ${context}:`, info)
  return info
}
