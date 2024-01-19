import Bot from "./services/bot.js"
import MyMidjourney from "./services/mymidjourney.js"

const mjservice = new MyMidjourney()
process.mjservice = mjservice
new Bot()
