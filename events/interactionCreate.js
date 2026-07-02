const { Events, ChannelType, PermissionsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const databaseService = require('../services/database');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        // Wrap interaction response methods to automatically log the bot's answers to the dashboard
        const originalReply = interaction.reply.bind(interaction);
        interaction.reply = async (options) => {
            const result = await originalReply(options);
            emitInteractionReply(interaction, options);
            return result;
        };

        const originalEditReply = interaction.editReply.bind(interaction);
        interaction.editReply = async (options) => {
            const result = await originalEditReply(options);
            emitInteractionReply(interaction, options);
            return result;
        };

        const originalFollowUp = interaction.followUp.bind(interaction);
        interaction.followUp = async (options) => {
            const result = await originalFollowUp(options);
            emitInteractionReply(interaction, options);
            return result;
        };

        if (interaction.client.broadcastEvent) {
            let detail = '';
            if (interaction.isChatInputCommand()) {
                detail = `Slash Command: /${interaction.commandName}`;
            } else if (interaction.isButton()) {
                detail = `Button Click: [${interaction.customId}]`;
            } else {
                detail = `Interaction: ${interaction.type}`;
            }

            interaction.client.broadcastEvent('interactionCreate', {
                guildId: interaction.guild?.id || 'DM',
                guildName: interaction.guild?.name || 'Direct Message',
                channelId: interaction.channel?.id || 'N/A',
                channelName: interaction.channel?.name || 'DM',
                author: interaction.user.tag,
                authorId: interaction.user.id,
                content: detail
            });
        }

        if (interaction.isChatInputCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);

            if (!command) {
                console.error(`No command matching ${interaction.commandName} was found.`);
                return;
            }

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(`Error executing command ${interaction.commandName}:`, error);
                
                if (error.code === 10062) {
                    return;
                }

                const replyOptions = { 
                    content: 'There was an error while executing this command!', 
                    ephemeral: true 
                };

                try {
                    if (interaction.replied || interaction.deferred) {
                        await interaction.followUp(replyOptions);
                    } else {
                        await interaction.reply(replyOptions);
                    }
                } catch (replyError) {
                    console.error('Failed to send error reply:', replyError);
                }
            }
        } else if (interaction.isButton()) {
            await handleButton(interaction);
        }
    },
};

async function handleButton(interaction) {
    if (interaction.customId === 'ticket_create') {
        await interaction.deferReply({ ephemeral: true });
        
        try {
            const guildId = interaction.guild.id;
            const config = await databaseService.GuildConfig.findOne({ guildId });
            const categoryId = config?.ticketCategoryId || null;

            // Generate ticket channel name
            const channelName = `ticket-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '');

            // Configure permissions
            const permissionOverwrites = [
                {
                    id: interaction.guild.roles.everyone.id,
                    deny: [PermissionsBitField.Flags.ViewChannel],
                },
                {
                    id: interaction.user.id,
                    allow: [
                        PermissionsBitField.Flags.ViewChannel,
                        PermissionsBitField.Flags.SendMessages,
                        PermissionsBitField.Flags.ReadMessageHistory,
                    ],
                },
                {
                    id: interaction.client.user.id,
                    allow: [
                        PermissionsBitField.Flags.ViewChannel,
                        PermissionsBitField.Flags.SendMessages,
                        PermissionsBitField.Flags.ReadMessageHistory,
                        PermissionsBitField.Flags.ManageChannels,
                    ],
                }
            ];

            // Create the channel
            const channel = await interaction.guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                parent: categoryId,
                permissionOverwrites,
            });

            // Send welcome embed in the new channel
            const ticketEmbed = new EmbedBuilder()
                .setTitle('🎫 Ticket Support')
                .setDescription(`Hello ${interaction.user}, welcome to your support ticket!\nOur staff will be with you shortly. Please describe your inquiry.`)
                .setColor('#0099ff')
                .setTimestamp();

            const closeButton = new ButtonBuilder()
                .setCustomId('ticket_close')
                .setLabel('Close Ticket')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🔒');

            const row = new ActionRowBuilder().addComponents(closeButton);

            await channel.send({
                content: `${interaction.user} Welcome!`,
                embeds: [ticketEmbed],
                components: [row]
            });

            await interaction.editReply({ content: `✅ Ticket created successfully: ${channel}` });
        } catch (error) {
            console.error('Error creating ticket channel:', error);
            await interaction.editReply({ content: '❌ Failed to create ticket. Please contact an administrator.' });
        }
    } else if (interaction.customId === 'ticket_close') {
        await interaction.reply({ content: '🔒 Closing ticket in 5 seconds...', ephemeral: false });
        
        setTimeout(async () => {
            try {
                await interaction.channel.delete();
            } catch (error) {
                console.error('Error deleting ticket channel:', error);
            }
        }, 5000);
    }
}

function emitInteractionReply(interaction, options) {
    try {
        if (!interaction.client.broadcastEvent) return;

        let content = '';
        if (typeof options === 'string') {
            content = options;
        } else if (options && typeof options === 'object') {
            if (options.content) {
                content = options.content;
            } else if (options.embeds && options.embeds.length > 0) {
                const embed = options.embeds[0];
                const parts = [];
                if (embed.data?.title || embed.title) parts.push(`**${embed.data?.title || embed.title}**`);
                if (embed.data?.description || embed.description) parts.push(embed.data?.description || embed.description);
                if (embed.data?.fields) {
                    for (const f of embed.data.fields) {
                        parts.push(`*${f.name}:* ${f.value}`);
                    }
                } else if (embed.fields) {
                    for (const f of embed.fields) {
                        parts.push(`*${f.name}:* ${f.value}`);
                    }
                }
                content = parts.join('\n');
            } else {
                content = '*(Interactive Response)*';
            }
        }

        if (content) {
            interaction.client.broadcastEvent('messageCreate', {
                guildId: interaction.guild?.id || 'DM',
                guildName: interaction.guild?.name || 'Direct Message',
                channelId: interaction.channel?.id || 'N/A',
                channelName: interaction.channel?.name || 'DM',
                author: interaction.client.user.tag,
                authorId: interaction.client.user.id,
                content: content
            });
        }
    } catch (e) {
        console.error('Error broadcasting interaction reply:', e);
    }
}
