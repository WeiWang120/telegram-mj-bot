import { parentPort } from "worker_threads"
import MjService from "./services/mymidjourney.js"
import { sleep } from "./utils.js"

const mjService = new MjService()

parentPort.on("message", async (data) => {
  let progress = 0
  let progressResult

  try {
    while (progress < 100) {
      progressResult = await mjService.getProgress(data)

      if (progressResult.error) {
        parentPort.postMessage({ error: progressResult.error })
      }

      await sleep(1000)
      progress = progressResult.progress

      // Send progress update to main thread
      parentPort.postMessage({ progressResult })
    }
  } catch (error) {
    parentPort.postMessage({ error })
  }
})
