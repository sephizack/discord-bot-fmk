import Discord from 'discord.js'
import Logger from './logger.js'
import PostAction from './PostAction.js'
import Utils from './utils.js'

namespace DiscordBot {

    type CustomPollOptions = {
        durationHours?: number,
        remindAfterHours?: number,
        reminderNbUniqueUsersExpected?: number,
        allowMultiselect?: boolean,
        callback?: any,
	}

    type CustomPollOptionsPrivate = {
        durationHours?: number,
        remindAfterHours?: number,
        reminderNbUniqueUsersExpected?: number,
        allowMultiselect?: boolean,
        callback?: any,
        _reminderDone?: boolean,
        _answersAdditionalData?: any,
        _createdTimestamp?: number,
        _lastNbVotes?: any
    }

    export class BaseDiscordBot {

        public constructor(token: string, channel:string, userActionCallback:any) {
            this.client = new Discord.Client({
                intents: [Discord.GatewayIntentBits.MessageContent
                        ,Discord.GatewayIntentBits.GuildMessages
                        ,Discord.GatewayIntentBits.GuildMessageReactions
                        ,Discord.GatewayIntentBits.DirectMessages
                        ,Discord.GatewayIntentBits.GuildIntegrations
                        ,Discord.GatewayIntentBits.GuildMessagePolls
                        ,Discord.GatewayIntentBits.Guilds]
                
            });
            this.channelsToNotify = []
            this.userActionCallback = userActionCallback
            this.botUsername = "(not logged)"
            this.channelIDsToNotify = []
            this.pollsToMonitor = new Map()
            this.pollsOptions = new Map()
            this.postActionMap = new Map()
            this.channelIDsToNotify.push(channel)
            this.setupClient()

            let thisBot = this;
            let discordLogin = () => {
                if (!thisBot.isConnected) {
                    Logger.info(thisBot.prefix(), "Appempting connection to discord")
                    thisBot.client.login(token).catch((error) => {
                        Logger.error(thisBot.prefix(), "Unable to conect to Discord", error)
                        thisBot.isConnected = false
                    });
                }
            }
            discordLogin();
            setInterval(discordLogin, 2*60*1000);
            setInterval(() => {
                if (thisBot.isConnected) {
                    this.monitorPolls()
                }
            }, 1000*7);
        }
        
        private async monitorPolls() {
            let pollsCompleted = []
            // Logger.debug(this.prefix(), "Monitoring polls: ", this.pollsToMonitor.size)
            for (let id of this.pollsToMonitor.keys()) {
                // Logger.debug(this.prefix(), "id", id)

                let m = this.pollsToMonitor.get(id)
                let pollOptions = this.pollsOptions.get(id)
                // Logger.debug(this.prefix(), "Monitoring poll message", m)
                // Logger.debug(this.prefix(), "Monitoring pollOptions", pollOptions)
                
                let canBeRemoved = await this.monitorPoll(m, pollOptions);
                if (canBeRemoved) {
                    pollsCompleted.push(id)
                }
            }
            for (let pollid of pollsCompleted)
                {
                Logger.info(this.prefix(), `Poll ${pollid} completed, removing it`, pollid)
                this.pollsToMonitor.delete(pollid);
            }
        }

        private async monitorPoll(m: Discord.Message, pollOptions: CustomPollOptionsPrivate) : Promise<boolean> {
            try {
                if (!m || !m.deletable)
                {
                    return true
                }
                // Logger.debug(this.prefix(), "Monitoring poll", m.id)
                if (m.poll.expiresTimestamp < Date.now()) {
                    // Callback completed
                    if (pollOptions.callback) {
                        try {
                            pollOptions.callback("complete", m, m.poll.answers)
                        } catch (error) {
                            Logger.error(this.prefix(), "Error calling poll complete callback", error)
                        }
                    }
                    return true;
                }
                
                if (!pollOptions._lastNbVotes) {
                    pollOptions._lastNbVotes = {}
                }

                // Call update callback when votes are updated
                let uniqueVoters = {}
                for (let item of m.poll.answers) {
                    try {
                        let answer = item[1];
                        if (pollOptions.reminderNbUniqueUsersExpected > 0) {
                            let voters = await answer.fetchVoters();
                            for (let voter of voters) {
                                uniqueVoters[voter[1].id] = voter
                            }
                            if (Object.keys(uniqueVoters).length >= pollOptions.reminderNbUniqueUsersExpected) {
                                pollOptions._reminderDone = true
                                // Logger.debug(this.prefix(), `Poll reminder will be skiped as ${pollOptions.reminderNbUniqueUsersExpected} replies received`)
                            }
                        }
                        if (!pollOptions._lastNbVotes[answer.id]) {
                            pollOptions._lastNbVotes[answer.id] = 0
                        }
                        if (pollOptions._lastNbVotes[answer.id] != answer.voteCount) {
                            pollOptions._lastNbVotes[answer.id] = answer.voteCount
                            // Callback vote update
                            if (pollOptions.callback) {
                                try {
                                    pollOptions.callback('update', m, m.poll.answers)
                                } catch (error) {
                                    Logger.error(this.prefix(), "Error calling poll vote update callback", error)
                                }
                            }
                        }
                    } catch (error) {
                        Logger.error(this.prefix(), "Error monitoring poll answer. Abort poll", error)
                        return true
                    }
                };

                if (!pollOptions._reminderDone && pollOptions.callback && pollOptions.remindAfterHours && pollOptions.remindAfterHours > 0.0)
                {
                    let reminderTimestamp = pollOptions._createdTimestamp + Math.ceil(pollOptions.remindAfterHours*60*60*1000)
                    // Logger.debug(this.prefix(), `Reminder in ${(reminderTimestamp - Date.now())/1000} seconds`)
                    if (reminderTimestamp < Date.now())
                    {
                        pollOptions._reminderDone = true
                        try {
                            pollOptions.callback('reminder', m, m.poll.answers)
                        } catch (error) {
                            Logger.error(this.prefix(), "Error calling poll reminder callback", error)
                        }
                    }
                }
            } catch (error) {
                Logger.error(this.prefix(), "Error monitoring poll", error)
            }
            return false
        }

        private setupClient() {
            this.client.on('ready', async () => {
                this.isConnected = true
                this.botUsername = this.client.user.username
                Logger.ok(this.prefix(), `Sucessfully logged in as ${this.client.user.tag} ! (Discriminator: ${this.client.user.discriminator})`);
                //Logger.debug(this.prefix(), this.client);
                await this.getChannels()
                this.userActionCallback("connected", "")

                let pres:Discord.PresenceData = {}
                pres.status = 'online';
                pres.activities = [{
                    name: '🎾 🎬 🇯🇵',
                    type: Discord.ActivityType.Custom
                }];

                this.client.user.setPresence(pres);

            });
            this.client.on('disconnect', () => {
                this.isConnected = false
            });
            this.client.on(Discord.Events.MessageCreate, message => {
                // Ignore if message is not in a channel we are monitoring
                if (this.channelIDsToNotify.indexOf(message.channelId) == -1) {
                    return
                }
                this.handleSpecialMessage(message)
            });
            this.client.on(Discord.Events.MessageReactionAdd, (event, user) => {
                if (this.channelIDsToNotify.indexOf(event.message.channelId) == -1) {
                    return
                }
                this.handleReactionAddition(event, user)
            });
            this.client.on(Discord.Events.InteractionCreate, async (interaction) => {
                try {
                    if (interaction.isButton())
                    {
                        let buttonInteraction:Discord.ButtonInteraction = interaction
                        if (this.channelIDsToNotify.indexOf(buttonInteraction.message.channelId) == -1) {
                            return
                        }
                        await this.handleButtonInteraction(buttonInteraction)
                    }
                    else if (interaction.isModalSubmit())
                    {
                        let modalInteraction:Discord.ModalSubmitInteraction = interaction
                        if (this.channelIDsToNotify.indexOf(modalInteraction.message.channelId) == -1) {
                            return
                        }
                        await this.handleModalSubmit(modalInteraction)
                    }
                    else
                    {
                        Logger.warning(this.prefix(), "Un-handled interaction type:", interaction.type)
                    }
                }
                catch (error) {
                    Logger.error(this.prefix(), "Error handling interaction", error)
                    this.sendMessage(`Error handling interaction:\n${error}`, {color: '#911515'})
                }
            });
        }
        
        private async handleModalSubmit(modalInteraction: Discord.ModalSubmitInteraction<Discord.CacheType>) {
            let postAction = this.postActionMap.get(modalInteraction.customId)
            if (postAction == null)
            {
                Logger.warning(this.prefix(), "No post action found for", modalInteraction.customId)
                return
            }
            // set inputs into post action
            for (let actionRow of modalInteraction.components) {
                for (let component of actionRow.components) {
                    postAction.setProvidedInput(component.customId, component.value)
                }
            }

            if (postAction.isInputMissing())
            {
                let embed = new Discord.EmbedBuilder()
                    .setTitle(`Some inputs are still missing for action **${postAction.description}**`)
                    .setDescription(`Expected inputs: ${postAction.expectedInputs.map((input) => input.id).join(", ")}\nProvided inputs: ${Object.keys(postAction.providedInputs).join(", ")}`)
                    .setColor('#911515');
                let interactionConfirmation:Discord.InteractionReplyOptions = {
                    embeds: [embed],
                    ephemeral: true
                }
                return await modalInteraction.reply(interactionConfirmation)
            }
            
            await this.runPostAction(modalInteraction, postAction)
        }

        private async handleButtonInteraction(buttonInteraction: Discord.ButtonInteraction<Discord.CacheType>) {
            let isConfirmation = buttonInteraction.customId.indexOf("confirm_") == 0
            let postActionId = buttonInteraction.customId.replace("confirm_", "")
            let postAction = this.postActionMap.get(postActionId)
            if (postAction == null)
            {
                Logger.warning(this.prefix(), "No post action found for", postActionId)
                this.userActionCallback("action_not_found", postActionId)
                return
            }

            if (!postAction.isConfirmationResquested() || isConfirmation)
            {
                if (postAction.expectedInputs && postAction.expectedInputs.length > 0)
                {
                    // Modal
                    postAction.resetInputs();
                    return this.handleGetInputViaModal(buttonInteraction, postAction)
                }
                this.runPostAction(buttonInteraction, postAction)
            }
            else
            {
                let embed = new Discord.EmbedBuilder()
                    .setDescription(`Are you sure you want to **${postAction.description}** ?`)
                    .setColor('#911515');
                let actionRow:any = new Discord.ActionRowBuilder().addComponents(new Discord.ButtonBuilder()
                    .setLabel("Confirm & proceed")
                    .setStyle(Discord.ButtonStyle.Danger)
                    .setCustomId(`confirm_${postActionId}`)
                );
                let interactionConfirmation:Discord.InteractionReplyOptions = {
                    embeds: [embed],
                    components: [actionRow],
                    ephemeral: true
                }
                await buttonInteraction.reply(interactionConfirmation)
            }
        }

        private async runPostAction(interaction: any, postAction: PostAction) {
            if (postAction.isAnnouced()) {
                this.sendMessage(`Action **${postAction.description}** requested by ${interaction.user.displayName}`, {color: '#0099ff'})
            }

            try {
                await interaction.deferReply({
                    ephemeral: postAction.isEphemeralReply()
                })
                let cb_reply = await postAction.run()
                if (cb_reply)
                {
                    await interaction.editReply(cb_reply)
                }
                else
                {
                    await interaction.deleteReply()
                }
            } catch (error) {
                Logger.error(this.prefix(), "Error running post action", error)
                this.sendMessage(`Error running action **${postAction.description}**:\n${error}`, {color: '#911515'})
            }
        }
        
        private handleGetInputViaModal(buttonInteraction: Discord.ButtonInteraction<Discord.CacheType>, postAction: PostAction) {
            // Show Modal
            Logger.debug(this.prefix(), "Showing modal for post action", postAction.description)
            const modal = new Discord.ModalBuilder()
                .setCustomId(buttonInteraction.customId)
                .setTitle('Input required');
            for (let input of postAction.expectedInputs) {

                const inputField = new Discord.TextInputBuilder()
                    .setCustomId(input.id ? input.id : "input")
                    .setLabel(input.label ? input.label : "input")
                    .setPlaceholder(input.placeholder ? input.placeholder : "")
                    .setValue(input.value ? input.value : "")
                    .setRequired(true)
                    .setStyle(Discord.TextInputStyle.Short);
                const actionrow:any = new Discord.ActionRowBuilder().addComponents(inputField);
                modal.addComponents(actionrow);
            }
            buttonInteraction.showModal(modal);
        }
        
        public async sendMessage(content:string, options:any = {}) {
            let all_buttons : Discord.ButtonBuilder[] = []
            let message = new Discord.EmbedBuilder();
            message.setDescription(content)
            if (options.color)
            {
                message.setColor(options.color)
            }
            else
            {
                message.setColor('#0099ff')
            }
            if (options.title)
            {
                message.setTitle(options.title)
            }
            if (options.fields)
            {
                for (let aField of options.fields) {
                    if (aField.name && aField.value) {
                        message.addFields({
                            name: aField.name,
                            value: aField.value
                        })
                    }
                    else 
                    {
                        Logger.warning(this.prefix(), "Field skiped, must have a name and a value", aField)
                    }
                }
            }

            if (options.buttons)
            {
                for (let aButton of options.buttons) {
                    let button = this.buildButton(aButton)
                    if (button)
                    {
                        all_buttons.push(button)
                    }
                }
            }

            if (options.image)
            {
                message.setImage(options.image)
            }

            
            // Send messages
            try {
                let publications = this.buildPublications(message, all_buttons)
                for (let publi of publications)
                {
                    for (let aChannel of this.channelsToNotify) {
                        await aChannel.send(publi)
                    }
                }
            } catch (error) {
                Logger.error(this.prefix(), "Error sending message", error, message)
            }
        }
        
        private buildPublications(message: Discord.EmbedBuilder, all_buttons: Discord.ButtonBuilder[]) {
            if (all_buttons.length == 0)
            {
                return [{ embeds: [message] }]
            }
            let publications = []
            // We should have 1 actionRows per 25 buttons
            let actionRowsList : Discord.ActionRowBuilder[][] = this.buildActionRowsList(all_buttons)
            for (let actionRows of actionRowsList)
            {
                let aMessageToSend = null
                if (publications.length == 0)
                {
                    publications.push({ embeds: [message], components: actionRows})
                } else
                {
                    publications.push({ embeds: [{
                        title: message.data.title,
                        description: "*Additional actions from previous message*",
                        color: message.data.color
                    }], components: actionRows})
                }
            }
            return publications
        }
        
        private buildButton(aButton: any): Discord.ButtonBuilder {
            if (!aButton || !aButton.label)
            {
                Logger.error(this.prefix(), "Button must have a label", aButton)
                return null
            }
            
            let button = new Discord.ButtonBuilder();
            if (aButton.label.length > 80)
            {
                Logger.warning(this.prefix(), "Button label too long, truncating", aButton.label)
                aButton.label = aButton.label.substring(0, 75) + "..."
            }
            button.setLabel(aButton.label)
            button.setEmoji(aButton.emoji)
            if (aButton.url)
            {
                button.setStyle(Discord.ButtonStyle.Link)
                button.setURL(aButton.url)
            }
            else if (aButton.callback)
            {
                let actionDescription = aButton.actionDescription ? aButton.actionDescription : aButton.label
                button.setStyle(aButton.isSecondary ? Discord.ButtonStyle.Secondary : Discord.ButtonStyle.Primary)
                if (aButton?.options?.needsConfirmation)
                {
                    button.setStyle(Discord.ButtonStyle.Danger)
                }
                let postActionId = Utils.getNewTokenForMap(this.postActionMap, 26)
                let postAction = new PostAction(actionDescription, '', 1, aButton.callback, aButton.options)
                this.postActionMap.set(postActionId, postAction)
                // Logger.debug(this.prefix(), "Post action created", postActionId)
                button.setCustomId(postActionId)
            }
            else
            {
                Logger.error(this.prefix(), "Button must have either a URL or a callback", aButton)
                return null
            }
            return button
        }

        private buildActionRowsList(all_buttons: Discord.ButtonBuilder[]): Discord.ActionRowBuilder[][] {
            let actionRowsList : Discord.ActionRowBuilder[][] = []
            let actionRows : Discord.ActionRowBuilder[] = []
            let actionRow = new Discord.ActionRowBuilder();
            let isButtonsFull = false
            for (let aButton of all_buttons) {
                actionRow.addComponents(aButton)
                if (actionRow.components.length == 5)
                {
                    actionRows.push(actionRow)
                    if (actionRows.length == 5)
                    {
                        actionRowsList.push(actionRows)
                        actionRows = []
                    }
                    actionRow = new Discord.ActionRowBuilder();
                }
            }
            if (actionRow && actionRow.components.length > 0)
            {
                actionRows.push(actionRow)
            }
            if (actionRows.length > 0)
            {
                actionRowsList.push(actionRows)
            }
            return actionRowsList
        }

        public async sendPoll(question:string, answers:any, options:CustomPollOptions = {}) {
            try {
                let pollOptions : CustomPollOptionsPrivate = {
                    remindAfterHours: options.remindAfterHours ? options.remindAfterHours : 0,
                    reminderNbUniqueUsersExpected: options.reminderNbUniqueUsersExpected ? options.reminderNbUniqueUsersExpected : 0,
                    callback: options.callback,
                    _reminderDone: false,
                    _answersAdditionalData: [],
                    _createdTimestamp: Date.now(),
                    _lastNbVotes: {}
                }
                for (let c of this.channelsToNotify) {
                    let aChannel : Discord.TextChannel = c;

                    let discordPollData = {
                        question: { text: question} ,
                        answers: [],
                        allowMultiselect: options.allowMultiselect ? options.allowMultiselect : false,
                        duration: options.durationHours ? options.durationHours : 1,
                    }
                    
                    for (let aAnswer of answers) {
                        pollOptions._answersAdditionalData.push({
                            id: aAnswer.id ? aAnswer.id : pollOptions._answersAdditionalData.length,
                            cb_data: aAnswer.cb_data ? aAnswer.cb_data : null,
                        });
                        discordPollData.answers.push({
                            text: aAnswer.text,
                            emoji: aAnswer.emoji ? aAnswer.emoji : null
                        })
                    }

                    let m = await aChannel.send({
                        poll: discordPollData
                    });
    
                    this.pollsToMonitor.set(m.id, m);
                    this.pollsOptions.set(m.id, pollOptions);
                }
            }
            catch (error) {
                Logger.error(this.prefix(), "Error sending poll", error)
                this.sendMessage(`Error creating poll:\n${error}`, {color: '#911515'})
            }
        }

        private handleSpecialMessage(message:Discord.Message)
        {
            if (message.author && message.author.discriminator == this.client.user.discriminator)
            {
                return
            }
            
            let botMention = `<@${this.client.user.id}>`
            // Check mentions
            message.content = message.content.trim()
            if (message.content.indexOf(botMention) !== -1) {
                Logger.debug(this.prefix(), "Mention for bot found in message:", message.content)
                this.userActionCallback("mention", message.content.replace(botMention, "").trim())
            }
            else if (message.content.indexOf("!") == 0) {
                this.userActionCallback("message", message.content)
            }
        }


        private handleReactionAddition(event: any, user: any) {
            try {
                if (event.message.embeds.length == 0)
                {
                    Logger.info(this.prefix(), "handleReactionAddition: No embeds found in message", event.message)
                    return
                }

                // Logger.debug(this.prefix(), "Reaction message", event.message.embeds)
                let reaction_callback_data = {
                    message: {
                        description : event.message.embeds[0].data.description,
                        title: event.message.embeds[0].data.title,
                        fields:  event.message.embeds[0].data.fields,
                        color: event.message.embeds[0].data.color
                    },
                    reaction: {
                        emoji: event._emoji.name,
                        count: event.count
                    }
                }
                Logger.debug(this.prefix(), "Reaction callback data", reaction_callback_data)
                this.userActionCallback("reaction", reaction_callback_data)
            } catch (error) {
                Logger.error(this.prefix(), "Error handling reaction", error)
            }
        }

        private async getChannels() {
            this.channelsToNotify = []
            for (let aChannelId of this.channelIDsToNotify) {
                try {
                    let channel = await this.client.channels.fetch(aChannelId);
                    this.channelsToNotify.push(channel)
                    Logger.ok(this.prefix(), `Channel with ID '${aChannelId}' ready to be notified`)
                } catch (error) {
                    Logger.warning(this.prefix(), `Channel with ID '${aChannelId}' not found:`, error)
                }
            }
        }

        private prefix() {
            return `[Discord ${this.botUsername}]`
        }

        isConnected: boolean;
        botUsername:string
        client: Discord.Client;
        channelsToNotify:any;
        userActionCallback:any;
        channelIDsToNotify:string[];
        postActionMap:Map<String, PostAction>;
        pollsToMonitor:Map<String, Discord.Message>;
        pollsOptions:Map<String, CustomPollOptionsPrivate>;
    }

}

export default DiscordBot