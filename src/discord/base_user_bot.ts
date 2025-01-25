import Logger from './logger.js'
import DiscordBot from './discord_bot.js'
import config from 'config'

	
export abstract class BaseDiscordUserBot {
	
	public constructor(name: string, discord: DiscordBot.BaseDiscordBot, config: any) {
		this.name = name
		this.discord = discord
		this.config = config
		Logger.debug(this.name, "Created with account config ", config)
		this.init()
	}
	
	public getBotName(): string
	{
		return this.name
	}

	public abstract handleAction(type:string, data: any);
	protected abstract init();

	protected async sleep(ms) {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	discord: DiscordBot.BaseDiscordBot
	name: string
	config: any
}

export default BaseDiscordUserBot;
