import { parentPort, workerData } from 'node:worker_threads'
import { indexTextFiles, type IndexEvent, type IndexRequest } from '../../../../deskmark-index/src/scan.ts'

const port = parentPort
const request = workerData as IndexRequest

if (!port) {
  throw new Error('索引线程需要由主进程启动')
}

let stop = false
let ack: (() => void) | null = null

port.on('message', (message: unknown) => {
  if (message === 'stop') stop = true
  if (message === 'ack') {
    const resume = ack
    ack = null
    resume?.()
  }
})

const emit = async(event: IndexEvent): Promise<void> => {
  port.postMessage(event)
  if (event.type !== 'notes') return
  await new Promise<void>((resolve) => {
    ack = resolve
  })
}

indexTextFiles(request, emit, () => stop).catch((error: unknown) => {
  port.postMessage({
    type: 'failed',
    message: error instanceof Error ? error.message : String(error)
  })
})
