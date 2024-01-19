import _ from "lodash"
import Moment from "moment"

class Router {
  constructor() {
    // 路由函数默认参数
    this.defaultCommandOptions = {
      triggers: ["command"],
      fields: [],
    }

    this.allRoutes = []
  }
  // 调用对应路由函数
  routes() {
    return async (ctx, next) => {
      const command = this.getCommandFromMessage(ctx),
        route = this.allRoutes.find((route) => route.command === command.command)
      // 无对应路由或触发方式不匹配
      if (_.isNull(command.command) || !_.isObject(route) || route.options.triggers.indexOf(command.trigger) === -1) {
        return next()
      }
      // 检查是否缺少参数
      const emptyFields = []
      route.options.fields.forEach((field) => {
        if (field.required && _.isEmpty(command.params[field.key])) {
          emptyFields.push(field.key)
        }
      })
      if (!_.isEmpty(emptyFields)) {
        const msgArr = [`${emptyFields} missing`]
        ctx.reply(msgArr.join("\n"), {
          reply_to_message_id: ctx.message.message_id,
        })
        return next()
      }
      // 调用对应参数
      try {
        await route.handler(ctx, command.params)
      } catch (err) {
        console.log(err)
      }

      await next()
    }
  }
  /**
   * 声明路由函数
   * @param { string } command - 指令名称
   * @param { object } options - 配置参数
   * @param { function } handler - 操作函数
   */
  setCommand(command, options = {}, handler) {
    this.allRoutes.push({ command, handler, options: this.commandOptions(options) })
  }
  /**
   * 从用户消息获取操作指令
   * @param { object } ctx - 消息上下文
   */
  getCommandFromMessage(ctx) {
    let botName = `@${ctx.botInfo.username}`,
      trigger = null,
      baseContent = null,
      command = null,
      params = {},
      userId = null,
      triggerAt = null
    // 提取消息中的文本内容以及用户 ID
    if (_.isObject(ctx.message) && _.isString(ctx.message.text)) {
      trigger = "command"
      baseContent = ctx.message.text.trim()
      userId = ctx.message.from.id.toString()
      triggerAt = ctx.message.date
    }
    if (_.isObject(ctx.update.callback_query) && _.isString(ctx.update.callback_query.data)) {
      trigger = "callback"
      baseContent = ctx.update.callback_query.data.trim()
      userId = ctx.update.callback_query.from.id.toString()
      triggerAt = ctx.update.callback_query.message.date
    }

    // 提取文本中的指令
    if (_.isString(baseContent)) {
      baseContent = baseContent.replace(new RegExp(botName, "g"), "").trim()
      const contentArr = baseContent
        .split(" ")
        .map((item) => item.trim())
        .filter((item) => item)
      if (baseContent.substring(0, 1) === "/") {
        command = _.head(contentArr).substring(1).trim()
      }
      // 获取指令附带的参数
      if (_.isString(command)) {
        const route = this.allRoutes.find((route) => route.command === command)
        if (_.isObject(route) && _.isArray(route.options.fields)) {
          const args = contentArr.map((item) => item)
          args.shift()
          params = this.parseArgs(route.options.fields, [args.join(" ")])
        }
      }
    }

    return { trigger, command, params }
  }
  /**
   * 格式化传入参数
   * @param { array } fields - 参数定义
   * @param { array } args - 传入参数
   */
  parseArgs(fields, args = []) {
    const params = {}

    fields.forEach((field, idx) => {
      let value = args[idx]
      if (_.isUndefined(value) && !_.isUndefined(field.defaultValue)) {
        value = field.defaultValue
      }
      if (!_.isUndefined(value) && field.toUpper) {
        value = value.toUpperCase()
      }
      if (!_.isUndefined(value) && field.toLower) {
        value = value.toLowerCase()
      }
      if (!_.isUndefined(value)) {
        try {
          params[field.key] = JSON.parse(value)
        } catch {
          params[field.key] = value
        }
      }
    })
    return params
  }
  /**
   * 生成路由配置参数
   * @param { object } - 用户传入的配置参数
   */
  commandOptions(options) {
    const _options = JSON.parse(JSON.stringify(options))
    for (let key of Object.keys(this.defaultCommandOptions)) {
      if (_.isUndefined(_options[key])) {
        _options[key] = this.defaultCommandOptions[key]
      }
    }
    return _options
  }
}

export default Router
