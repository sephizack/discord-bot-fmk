import Logger from './logger.js'
import DiscordBot from './discord_bot.js'
import BaseDiscordUserBot from './base_user_bot.js';

type BotData = {
	discordBot: DiscordBot.BaseDiscordBot;
	botsOptions: BotOptions
	userBotConstructor: any
	userBot: BaseDiscordUserBot;
}

type BotOptions = {
	config: any
}

export class DiscordBotApp {

	allDiscordsBots: Map<string, BotData> = new Map()
	

	public constructor() {
		this.setupUnhandledIssues()
	}

	public createUserBot(botName: string, userBotConstructor: typeof BaseDiscordUserBot, dsToken: string, dsChannel: string, options: BotOptions) : DiscordBot.BaseDiscordBot {
		if (this.allDiscordsBots.has(botName))
		{
			Logger.warning(`Discord bot for ${botName} already exists`)
			return
		}

		if (dsToken == null || dsToken == "")
		{
			Logger.error(`Discord token for ${botName} is empty`)
			return
		}

		if (dsChannel == null || dsChannel == "")
		{
			Logger.error(`Discord channel id for ${botName} is empty`)
			return
		}

		if (dsChannel == "YOUR_CHANNEL_ID")
		{
			Logger.error(`Discord channel id for ${botName} is not set, update it in the config file`)
			return
		}

		let aDiscordBot = new DiscordBot.BaseDiscordBot(
			dsToken,
			dsChannel,
			async (type, data) => {
				await this.discordActionDispatcher(botName, type, data)
			}
		)
		let aUserBot: BotData = {
			discordBot: aDiscordBot,
			botsOptions: options,
			userBotConstructor: userBotConstructor,
			userBot: null,
		}
		this.allDiscordsBots.set(botName, aUserBot)
		
		return aDiscordBot
	}

	public testMessage(botName: string, message: string, timeout_ms: number = 0) {
		let bot = this.allDiscordsBots.get(botName)
		if (bot == null)
		{
			Logger.warning(`Discord bot for ${botName} not found`)
			return
		}
		setTimeout(() => {
			Logger.info(`Sending test message to ${botName}: ${message}`)
			this.discordActionDispatcher(botName, "message", message)
		}, timeout_ms);
	}

	private setupUnhandledIssues() {
		process.on('unhandledRejection', async (reason: string, p: Promise<any>) => {
			Logger.error(`Unhandled Promise Rejection:`, 'Promise:', p, 'Reason:', reason);
			let message = `Promise: ${p}. Reason: ${reason}`;
			this.unhandledIssue('Promise Rejection', message);
		});

		process.on('uncaughtException', async (error: Error) => {
			let message = `Uncaught exception: ${error}. Exception origin: ${error.stack}`;
			this.unhandledIssue('Uncaught Exception', message);
		});
	}


	private async discordActionDispatcher(name, type, data)
	{
		let botData: BotData = this.allDiscordsBots.get(name)
		if (botData == null)
		{
			Logger.warning(`Discord bot for ${name} not found`)
			return
		}

		if (type == "connected")
		{
			Logger.info(`Creating user bot ${name} ...`)
			try {
				botData.userBot = new botData.userBotConstructor(name, botData.discordBot, botData.botsOptions.config)
				await botData.userBot.init()
			} catch (e) {
				Logger.error(`Error while creating user bot ${name}:`, e)
				throw e
			}
		}
		else if (botData.userBot == null)
		{
			Logger.info("Discord bot not ready yet")
			return
		}
		else
		{
			botData.userBot.handleAction(type, data)
		}
	}

	private async unhandledIssue(type: string, message: string) {
		Logger.error(`Unhandled ${type}:`, 'Message:', message);
		for (let bot of this.allDiscordsBots.values()) {
			await bot.discordBot.sendMessage(message+`\n\nPlease check logs for details.\n**Killing process in 3 seconds ...**`, {
				title: `Unhandled ${type}`,
				color: 0xff0000
			});
		}
		setTimeout(() => {
			process.exit(1);
		}, 3000);
	}
}

export default DiscordBotApp
