import _ from "lodash"
import Router from "../middleware/router.js"
import { Worker } from "worker_threads"

const router = new Router()

router.setCommand(
  "start",
  {
    triggers: ["command", ""],
    fields: [],
  },
  async (ctx) => {
    ctx.reply("Welcome to your personal midjourney bot in telegram, use /imagine to start generating your first image")
  }
)

router.setCommand(
  "help",
  {
    triggers: ["command", ""],
    fields: [],
  },
  async (ctx) => {
    ctx.reply("Some help information")
  }
)

router.setCommand(
  "imagine",
  {
    triggers: ["command", "callback"],
    fields: [],
  },
  async (ctx) => {
    await ctx.scene.enter("imagine-wizard")
  }
)

router.setCommand(
  "button",
  {
    triggers: ["command", "callback"],
    fields: [
      {
        key: "messageId_button",
        required: true,
      },
    ],
  },
  async (ctx, { messageId_button }) => {
    const messageIdButton = messageId_button.split(" ")
    const messageId = messageIdButton[0]
    messageIdButton.shift()
    const button = messageIdButton.join(" ")
    const data = await process.mjservice.createButton({ messageId, button })
    if (data.success) {
      let replyText = "",
        caption = ""
      switch (button) {
        case "U1":
          replyText = "Upscaling image #1"
          caption = "Image #1"
          break
        case "U2":
          replyText = "Upscaling image #2"
          caption = "Image #2"
          break
        case "U3":
          replyText = "Upscaling image #3"
          caption = "Image #3"
          break
        case "U4":
          replyText = "Upscaling image #4"
          caption = "Image #4"
          break
        case "🔄":
          replyText = "Regenerating image..."
          break
        case "V1":
          replyText = "Creating variants of image #1"
          caption = "Image #1"
          break
        case "V2":
          replyText = "Creating variants of image #2"
          caption = "Image #2"
          break
        case "V3":
          replyText = "Creating variants of image #3"
          caption = "Image #3"
          break
        case "V4":
          replyText = "Creating variants of image #4"
          caption = "Image #4"
          break
        case "Vary (Subtle)":
          replyText = "Creating subtle variants"
          caption = "Vary (Subtle)"
          break
        case "Vary (Strong)":
          replyText = "Creating strong variants"
          caption = "Vary (Strong)"
          break
        case "Zoom Out 2x":
          replyText = "Zooming out 2x image"
          caption = "Zoom Out 2x"
          break
        case "Zoom Out 1.5x":
          replyText = "Zooming out 1.5x image"
          caption = "Zoom Out 1.5x"
          break
      }
      ctx.reply(replyText)
      let tgMessageId, chatId, lastProgress
      const worker = new Worker("./progressWorker.js")
      worker.postMessage(data)
      worker.on("message", async ({ error, progressResult }) => {
        if (error) {
          ctx.reply(`Checking progress error: ${error}, please retry`)
          console.error(error)
          worker.terminate()
        } else if (progressResult) {
          if (progressResult.messageId !== data.messageId) return
          const prompt = progressResult.prompt
          const progress = progressResult.progress
          if (!_.isNull(progress)) {
            if (!tgMessageId) {
              try {
                const message = await ctx.replyWithPhoto(progressResult.uri, {
                  caption: `${prompt} - (${progress}%)`,
                })
                tgMessageId = message.message_id
                chatId = message.chat.id
              } catch (error) {
                ctx.reply(`Unexpected error occured: ${error}, please retry`)
              }
            } else {
              if (lastProgress !== progress) {
                try {
                  await ctx.telegram.editMessageMedia(chatId, tgMessageId, null, {
                    type: "photo",
                    media: progressResult.uri,
                    caption: `${prompt} - (${progress}%)`,
                  })
                } catch (error) {}
              }
            }
            lastProgress = progress
          }

          if (progress === 100) {
            let inline_keyboard = []
            if (!["U1", "U2", "U3", "U4"].includes(button)) {
              inline_keyboard = [
                [
                  { text: "U1", callback_data: `/button ${data.messageId} U1` },
                  { text: "U2", callback_data: `/button ${data.messageId} U2` },
                  { text: "U3", callback_data: `/button ${data.messageId} U3` },
                  { text: "U4", callback_data: `/button ${data.messageId} U4` },
                ],
                [{ text: "🔄", callback_data: `/button ${data.messageId} 🔄` }],
                [
                  { text: "V1", callback_data: `/button ${data.messageId} V1` },
                  { text: "V2", callback_data: `/button ${data.messageId} V2` },
                  { text: "V3", callback_data: `/button ${data.messageId} V3` },
                  { text: "V4", callback_data: `/button ${data.messageId} V4` },
                ],
              ]
            } else {
              inline_keyboard = [
                [
                  { text: "Vary (Subtle)", callback_data: `/button ${data.messageId} Vary (Subtle)` },
                  { text: "Vary (Strong)", callback_data: `/button ${data.messageId} Vary (Strong)` },
                ],
                [
                  { text: "Zoom Out 2x", callback_data: `/button ${data.messageId} Zoom Out 2x` },
                  { text: "Zoom Out 1.5x", callback_data: `/button ${data.messageId} Zoom Out 1.5x` },
                ],
              ]
            }

            // 图片生成完成
            try {
              await ctx.telegram.sendPhoto(
                chatId,
                { url: progressResult.uri },
                {
                  caption: `'${prompt}' - ${caption}`,
                  reply_markup: {
                    inline_keyboard,
                  },
                }
              )
              await ctx.telegram.deleteMessage(chatId, tgMessageId)
            } catch (error) {
              ctx.reply(`Unexpected error occured: ${error}, please retry`)
              console.error(error)
            }
            worker.terminate()
          }
        }
      })
    }
  }
)

export default router
