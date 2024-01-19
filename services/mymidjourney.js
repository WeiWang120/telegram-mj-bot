import Config from "../config.js"
import axios from "axios"
import crypto from "crypto"

class MyMidjourney {
  constructor() {
    this.mjClient = axios.create({
      baseURL: "https://api.mymidjourney.ai/api/v1/midjourney",
      timeout: 10000,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Config.myMidjourneyToken}`,
      },
    })
  }

  async createImagine(data) {
    try {
      // POST to https://api.mymidjourney.ai/api/v1/midjourney/imagine with data and mjClient
      const response = await this.mjClient.post("/imagine", data)
      return response.data
    } catch (error) {
      const traceId = crypto.randomUUID()
      console.error(`traceId: ${traceId}, data: ${JSON.stringify(data, null, 2)}`, error)
      throw new Error(`createImagine failed, traceId: ${traceId}`)
    }
  }

  async createButton(data) {
    try {
      // POST to https://api.mymidjourney.ai/api/v1/midjourney/button with data and mjClient
      const response = await this.mjClient.post("/button", data)
      return response.data
    } catch (error) {
      const traceId = crypto.randomUUID()
      console.error(`traceId: ${traceId}, data: ${JSON.stringify(data, null, 2)}`, error)
      throw new Error(`createButton failed, traceId: ${traceId}`)
    }
  }

  async getProgress(data) {
    try {
      // GET to https://api.mymidjourney.ai/api/v1/midjourney/progress with data and mjClient
      const response = await this.mjClient.get(`/message/${data.messageId}`)
      return response.data
    } catch (error) {
      const traceId = crypto.randomUUID()
      console.error(`traceId: ${traceId}, data: ${JSON.stringify(data, null, 2)}`, error)
      throw new Error(`getProgress failed, traceId: ${traceId}`)
    }
  }
}

export default MyMidjourney
