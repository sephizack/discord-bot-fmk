import Logger from './logger.js'
import DiscordBot from './discord_bot.js'
import config from 'config'


type ApiCallResult = {
	status: number,
	isJson: boolean,
	data?: any,
	error?: string
}
export abstract class BaseDiscordUserBot {
	
	public constructor(name: string, discord: DiscordBot.BaseDiscordBot, config: any) {
		this.name = name
		this.discord = discord
		this.config = config
		// Logger.debug(this.name, "Created !")
		this.init()
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
	protected abstract init();

	protected async sleep(ms) {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	protected async GET(url = '', auth_header = "") : Promise<ApiCallResult> {
		return this.callApi(url, null, 'GET', auth_header)
	}
	
	protected async POST(url = '', body = {}, auth_header = "") : Promise<ApiCallResult> {
		return this.callApi(url, body, 'POST', auth_header)
	}

	protected async callApi(url = '', body = {}, method = 'POST', auth_header = "") : Promise<ApiCallResult>
	{
		await this.sleep(277);
		let response = null;
		try {
			response = await fetch(url, {
				"headers": {
					"accept": "*/*",
					"accept-language": "en-US,en;q=0.9",
					"content-type": "application/json; charset=UTF-8",
					"sec-ch-ua": "\"Not_A Brand\";v=\"8\", \"Chromium\";v=\"120\"",
					"sec-ch-ua-mobile": "?0",
					"sec-ch-ua-platform": "\"macOS\"",
					"sec-fetch-dest": "empty",
					"sec-fetch-mode": "cors",
					"sec-fetch-site": "same-origin",
					"x-requested-with": "XMLHttpRequest",
					"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
					"Authorization": auth_header == "" ? null : auth_header
				},
				"body": body == null ? null : JSON.stringify(body),
				"method": method
			});
		}
		catch (e)
		{
			Logger.error(this.name, "Error while calling API "+url, e);
			return {
				status: 500,
				error: e,
				isJson: false
			}
		}
		

		let rawData:any = await response.text();
		if (response.status != 200 && response.status != 201)
		{
			return {
				status: response.status,
				error: response.statusText + " - " + rawData,
				isJson: false
			}
		}
		let isJson = false
		try {
			rawData = JSON.parse(rawData);
			isJson = true;
		}
		catch (e) {
			// Not json
		}
		if (isJson && rawData.status == 400)
		{
			rawData.error = rawData.message
		}

		let result = {
			status: response.status,
			isJson: isJson,
			data: rawData
		}

		return this.apiCallErrorHook(url, result)
	}

	protected getNowWithShift(op: string) {
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
