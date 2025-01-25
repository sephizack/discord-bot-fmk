import DiscordBotApp from './discord/discord_bot_app.js'
import Config from 'config';
import { DemoUserBot } from './modules/demoUserBot.js'

let myBotConf = Config.MyDiscordBot1
let myDiscordApp = new DiscordBotApp()
myDiscordApp.createUserBot("DemoBot", DemoUserBot, myBotConf.token, myBotConf.channel, {
    config: myBotConf.config
});