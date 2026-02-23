import { useEffect } from 'react'
import type { WsMessage } from '../lib/types'
import { useLeStudioStore } from '../store'

export const useWebSocket = () => {
  const appendLog = useLeStudioStore((s) => s.appendLog)
  const setProcStatus = useLeStudioStore((s) => s.setProcStatus)
  const setWsReady = useLeStudioStore((s) => s.setWsReady)
  const setApiHealth = useLeStudioStore((s) => s.setApiHealth)
  const setApiSupport = useLeStudioStore((s) => s.setApiSupport)

  useEffect(() => {
    let ws: WebSocket | null = null
    let reconnectTimer: number | undefined
    let closed = false

    const connect = () => {
      ws = new WebSocket(`ws://${location.host}/ws`)

      ws.onopen = () => {
        setWsReady(true)
      }

      ws.onclose = () => {
        setWsReady(false)
        if (!closed) {
          reconnectTimer = window.setTimeout(connect, 3000)
        }
      }

      ws.onmessage = (evt) => {
        const msg = JSON.parse(evt.data) as WsMessage
        if (msg.type === 'output') {
          const text = msg.text ?? msg.line ?? ''
          appendLog(msg.process, text, msg.kind)
        }
        if (msg.type === 'status') {
          setProcStatus(msg.processes)
        }
        if (msg.type === 'api_health') {
          setApiHealth(msg.key, msg.value)
        }
        if (msg.type === 'api_support') {
          setApiSupport(msg.key, msg.value)
        }
      }
    }

    connect()
    return () => {
      closed = true
      setWsReady(false)
      if (reconnectTimer) window.clearTimeout(reconnectTimer)
      ws?.close()
    }
  }, [appendLog, setApiHealth, setApiSupport, setProcStatus, setWsReady])
}
