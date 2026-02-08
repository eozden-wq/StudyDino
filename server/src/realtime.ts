import { WebSocket } from "ws"

const groupSockets = new Map<string, Set<WebSocket>>()

export const registerSocket = (groupId: string, socket: WebSocket) => {
    let sockets = groupSockets.get(groupId)
    if (!sockets) {
        sockets = new Set()
        groupSockets.set(groupId, sockets)
    }
    sockets.add(socket)
}

export const unregisterSocket = (groupId: string, socket: WebSocket) => {
    const sockets = groupSockets.get(groupId)
    if (!sockets) return
    sockets.delete(socket)
    if (sockets.size === 0) {
        groupSockets.delete(groupId)
    }
}

export const broadcastToGroup = (groupId: string, payload: unknown) => {
    const sockets = groupSockets.get(groupId)
    if (!sockets || sockets.size === 0) return
    const message = JSON.stringify(payload)
    sockets.forEach((socket) => {
        if (socket.readyState === WebSocket.OPEN) {
            socket.send(message)
        }
    })
}
