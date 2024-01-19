import Config from "../config.js"
import Router from "../routes/index.js"
import pkg from "telegraf"
import _ from "lodash"
import { Worker } from "worker_threads"

const { Telegraf, session, Scenes } = pkg

class Bot {
  constructor() {
    this.bot = new Telegraf(Config.bot.token, { handlerTimeout: 9_000_000 })
    this.bot.startPolling()

    this.bot.telegram.setMyCommands(Config.bot.commands)
    const imagineWizard = new Scenes.WizardScene(
      "imagine-wizard",
      (ctx) => {
        ctx.reply(
          "Please enter your prompts, the prompts can be\n✅ Text prompts\n✅ Image url + text prompts\n✅ Text prompts + parameters\n✅ Image url + text prompts + parameters\n\n Examples: \n✅https://cat.png Make this cat a space cat --ar 2:3\n✅A girl in white dress wearing a diamond necklace\n\nTo learn more about prompts please visit https://docs.midjourney.com/docs/prompts-2\n"
        )
        return ctx.wizard.next()
      },
      async (ctx) => {
        const prompt = ctx.message.text
        const photo = ctx.message.photo
        if (photo) {
          ctx.reply(`To use photo in prompt, please include the photo url as part of prompt.`)
          ctx.scene.leave()
          return
        }
        try {
          const data = await process.mjservice.createImagine({ prompt })
          console.log(data, prompt)
          if (data.success) {
            ctx.reply(`Generating your image...`)
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
                const progress = progressResult.progress
                // handle the result like updating the message
                if (!_.isNull(progress)) {
                  if (!tgMessageId) {
                    try {
                      console.log(progressResult)
                      const message = await ctx.replyWithPhoto(progressResult.uri, {
                        caption: `${prompt} - (${progress}%)`,
                      })
                      tgMessageId = message.message_id
                      chatId = message.chat.id
                    } catch (error) {
                      ctx.reply(`Reply photo error: ${error}, please retry`)
                      console.error(error)
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
                  // 图片生成完成
                  try {
                    await ctx.telegram.sendPhoto(
                      chatId,
                      { url: progressResult.uri },
                      {
                        caption: `'${prompt}' - (100%)`,
                        reply_markup: {
                          inline_keyboard: [
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
                          ],
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
        } catch (error) {
          ctx.reply(`Create image error: ${error}, please retry`)
          console.error(error)
        }
        return ctx.scene.leave()
      }
    )
    const stage = new Scenes.Stage([imagineWizard])

    this.bot.use(session())
    this.bot.use(stage.middleware())
    this.bot.use(Router.routes())
  }
}

export default Bot
