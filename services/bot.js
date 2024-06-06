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
          "Please enter your prompts, the prompts examples: \n✅https://cat.png Make this cat a space cat --ar 2:3\n✅A girl in white dress wearing a diamond necklace\n\nTo learn more about prompts please visit https://docs.midjourney.com/docs/prompts-2\n"
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

                console.log(progressResult)
                const progress = progressResult.progress
                // handle the result like updating the message
                if (!_.isNull(progress) && !_.isUndefined(progress)) {
                  if (!tgMessageId) {
                    try {
                      chatId = ctx.message.chat.id
                      const message = await ctx.sendPhoto(
                        { url: progressResult.uri },
                        {
                          caption: `'${prompt} - ${progress}%`,
                        }
                      )
                      tgMessageId = message.message_id
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
                    let inline_keyboard = []
                    const keyboards = progressResult.buttons.map((button) => {
                      return { text: button, callback_data: `/button ${data.messageId} ${button}` }
                    })
                    if (keyboards.length === 9) {
                      inline_keyboard = [keyboards.slice(0, 4), keyboards.slice(4, 5), keyboards.slice(5, 9)]
                    } else {
                      inline_keyboard = _.chunk(keyboards, 2)
                    }
                    await ctx.telegram.sendPhoto(
                      chatId,
                      { url: progressResult.uri },
                      {
                        caption: `'${prompt}' - (100%)`,
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
