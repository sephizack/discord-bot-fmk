import Logger from './logger.js'
import DiscordBot from './discord_bot.js'
import config from 'config'
import Utils from './utils.js'



export abstract class BaseDiscordUserBot {
	
	public constructor(name: string, discord: DiscordBot.BaseDiscordBot, config: any) {
		this.name = name
		this.discord = discord
		this.config = config
	}
	
	public getBotName(): string
	{
		return this.name
	}

	protected log(logFunction: any, ...args:any[]) {
		logFunction(`[${this.name}]`, ...args)
	}

	protected async apiCallErrorHook(url: string, result: any) {
		Logger.info(this.name, "No API error hook defined")
		return result
	}

	public abstract handleAction(type:string, data: any);
	public abstract init();

	protected async sleep(ms) {
		return Utils.sleep(ms)
	}

	protected async GET(url = '', auth_header = "") : Promise<Utils.ApiCallResult> {
		return this.callApi(url, null, 'GET', auth_header)
	}
	
	protected async POST(url = '', body = {}, auth_header = "") : Promise<Utils.ApiCallResult> {
		return this.callApi(url, body, 'POST', auth_header)
	}

	protected async callApi(url = '', body = {}, method = 'POST', auth_header = "") : Promise<Utils.ApiCallResult>
	{
		let result = await Utils.callApi(url, body, method, auth_header)
		return this.apiCallErrorHook(url, result)
	}

	protected getNowWithShift(op: string) : Date {
		if (!op)
		{
			return new Date()
		}
		let opMap = {
			"m": 60,
			"h": 60 * 60,
			"d": 60 * 60 * 24
		}
		for (let key in opMap)
		{
			if (op.indexOf(key) > 0)
			{
				let value = parseInt(op.replace(key, ""))
				return new Date(new Date().getTime() + 1000 * value * opMap[key])
			}
		}
		throw new Error(`Invalid operation: ${op}`)
	}

	discord: DiscordBot.BaseDiscordBot
	name: string
	config: any
}

export default BaseDiscordUserBot;
