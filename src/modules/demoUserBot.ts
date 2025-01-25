import Logger from '../discord/logger.js'
import Utils from '../discord/utils.js'
import { BaseDiscordUserBot } from '../discord/base_user_bot.js';

export class DemoUserBot extends BaseDiscordUserBot {
	protected async init() {
		this.discord.sendMessage("Hello I'm "+this.name, {
			title: "Bot started",
			color: "#800080",
			fields: [],
			buttons: this.getHelpButtons()
		})
	}

	private getHelpButtons() {
		return [
			{
				label: "Test send message",
				emoji: "🎥",
				options: {
					announcement:false,
					executeOnlyOnce: false
				},
				callback: async (inputs) => {
					await this.discord.sendMessage("Here is a message", {})
				}
			},
			{
				label: "Generate a random string",
				emoji: "🎲",
				options: {
					announcement:false,
					executeOnlyOnce: false,
					inputs: [
						{id: "length", label: "String length", placeholder: "10"},
					],
				},
				callback: async (inputs) => {
					let len = parseInt(inputs['length'])
					if (len > 100 || len < 1)
					{
						this.discord.sendMessage(`String length must be between 1 and 100`, {})
						return
					}
					let randomString = Utils.genRandStr(len)
					this.discord.sendMessage(`Random string: ${randomString}`, {})
				}
			},
			{
				label: "Display help",
				emoji: "📚",
				options: {
					announcement: true,
					executeOnlyOnce: false
				},
				callback: async (inputs) => {
					this.displayHelp()
				}
			}
		]
	}

	public async handleAction(type:string, data: any) {
		Logger.debug(this.name, "handleAction", type, data)
		if(type == "action_not_found")
		{
			this.discord.sendMessage(`Seems like you are trying to use buttons of a previous version of me :o`, {
				title: "Latest interaction buttons",
				buttons: this.getHelpButtons()
			})
		}
		else if (type=="mention")
		{
			if (data.startsWith("!help"))
			{
				this.displayHelp()
			}
			else {
				this.discord.sendMessage(`Unknown command: ${data}`, {
					title: "Unknown command",
					color: "#FF0000"
				})
			}
		}
	}

	private displayHelp() {
		this.discord.sendMessage(`Demo bot`, {
			title: `Bot Help`,
			description: `Usage: @NASBot <search>`,
			fields: [
				{
					name: `@NASBot <search_text>`,
					value: `Recherche un film sur IMdB`
				}
			],
			color: "#0000FF",
			buttons: this.getHelpButtons()
		})
	}
	
}

export default DemoUserBot
