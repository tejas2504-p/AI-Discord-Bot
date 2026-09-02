const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField, SnowflakeUtil } = require('discord.js');

class DiscordActions {
    /**
     * Helper to ask the user for confirmation via ephemeral followUp.
     */
    async awaitConfirmation(interaction, actionDescription) {
        if (!interaction || !interaction.channel) {
            return false;
        }

        const confirmId = `confirm_${Date.now()}`;
        const cancelId = `cancel_${Date.now()}`;

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(confirmId)
                    .setLabel('Confirm')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId(cancelId)
                    .setLabel('Cancel')
                    .setStyle(ButtonStyle.Secondary)
            );

        let promptMsg;
        try {
            promptMsg = await interaction.followUp({
                content: `**SECURITY CONFIRMATION REQUIRED**\nThe AI wants to: ${actionDescription}\nDo you allow this?`,
                components: [row],
                ephemeral: true,
                fetchReply: true
            });
        } catch (e) {
            console.error("Failed to send confirmation prompt:", e);
            return false;
        }

        try {
            const filter = i => (i.customId === confirmId || i.customId === cancelId) && i.user.id === interaction.user.id;
            const confirmation = await promptMsg.awaitMessageComponent({ filter, time: 20000 });
            
            // Delete the prompt msg
            await interaction.webhook.deleteMessage(promptMsg.id).catch(() => {});
            
            return confirmation.customId === confirmId;
        } catch (e) {
            // Timeout or error
            await interaction.webhook.deleteMessage(promptMsg.id).catch(() => {});
            return false;
        }
    }

    async send_message(interaction, channelId, message) {
        try {
            let channel;
            
            // Clean up the channelId if it's a mention like <#123456789>
            if (channelId.startsWith('<#') && channelId.endsWith('>')) {
                channelId = channelId.slice(2, -1);
            }

            if (!/^\d+$/.test(channelId)) {
                // If it's not purely digits, treat it as a channel name
                const channelName = channelId.startsWith('#') ? channelId.slice(1) : channelId;
                
                // Try to find the channel in the current guild
                if (interaction.guild) {
                    channel = interaction.guild.channels.cache.find(c => 
                        c.name.toLowerCase() === channelName.toLowerCase()
                    );
                }
                
                if (!channel) {
                    return { success: false, error: `Channel with name '#${channelName}' not found.` };
                }
            } else {
                // Fetch by ID
                channel = await interaction.client.channels.fetch(channelId);
                if (!channel) return { success: false, error: "Channel not found by ID." };
            }

            if (!channel.isTextBased()) return { success: false, error: "Channel is not text-based." };
            
            console.log(`[DISCORD] Sending message to ${channel.name || channel.id}`);
            const sentMsg = await channel.send(message);
            console.log(`[DISCORD] Message sent successfully (ID: ${sentMsg.id})`);
            
            return { success: true, messageId: sentMsg.id };
        } catch (error) {
            console.error(`[DISCORD] Failed to send message: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    async create_channel(interaction, name, type) {
        try {
            const confirmed = await this.awaitConfirmation(interaction, `Create a new ${type} channel named #${name}`);
            if (!confirmed) return { success: false, error: "User denied the action." };

            const channelType = type.toLowerCase() === 'voice' ? ChannelType.GuildVoice : ChannelType.GuildText;
            const channel = await interaction.guild.channels.create({
                name: name,
                type: channelType
            });
            return { success: true, channelId: channel.id };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async edit_message(interaction, messageId, content) {
        try {
            const channel = interaction.channel;
            const msg = await channel.messages.fetch(messageId);
            if (!msg) return { success: false, error: "Message not found in the current channel." };
            
            await msg.edit(content);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async delete_message(interaction, messageId) {
        try {
            const channel = interaction.channel;
            const msg = await channel.messages.fetch(messageId);
            if (!msg) return { success: false, error: "Message not found in the current channel." };

            const confirmed = await this.awaitConfirmation(interaction, `Delete message with ID ${messageId} in #${channel.name}`);
            if (!confirmed) return { success: false, error: "User denied the action." };

            await msg.delete();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async fetch_messages(interaction, channelId, limit) {
        try {
            let channel;
            
            // Clean up the channelId if it's a mention like <#123456789>
            if (channelId.startsWith('<#') && channelId.endsWith('>')) {
                channelId = channelId.slice(2, -1);
            }

            if (!/^\d+$/.test(channelId)) {
                // If it's not purely digits, treat it as a channel name
                const channelName = channelId.startsWith('#') ? channelId.slice(1) : channelId;
                
                // Try to find the channel in the current guild
                if (interaction.guild) {
                    channel = interaction.guild.channels.cache.find(c => 
                        c.name.toLowerCase() === channelName.toLowerCase()
                    );
                }
                
                if (!channel) {
                    return { success: false, error: `Channel with name '#${channelName}' not found.` };
                }
            } else {
                // Fetch by ID
                channel = await interaction.client.channels.fetch(channelId);
                if (!channel) return { success: false, error: "Channel not found by ID." };
            }

            if (!channel.isTextBased()) return { success: false, error: "Channel is not text-based." };

            const fetchLimit = Math.min(parseInt(limit) || 10, 100);
            console.log(`[DISCORD] Fetching messages from ${channel.name || channel.id} (limit: ${fetchLimit})`);
            
            const messages = await channel.messages.fetch({ limit: fetchLimit });
            console.log(`[DISCORD] Found ${messages.size} messages`);
            
            const result = [];
            messages.forEach(msg => {
                result.push({
                    messageId: msg.id,
                    authorId: msg.author.id,
                    authorName: msg.author.username,
                    content: msg.content,
                    timestamp: msg.createdTimestamp
                });
            });
            
            return { success: true, messages: result };
        } catch (error) {
            console.error(`[DISCORD] Fetch failed:`, error.message);
            return { success: false, error: error.message };
        }
    }

    async bulk_delete_messages(interaction, messageIds) {
        try {
            const channel = interaction.channel;
            
            // Check permissions
            if (!interaction.guild.members.me.permissionsIn(channel).has(PermissionsBitField.Flags.ManageMessages)) {
                return { success: false, error: "The bot lacks 'Manage Messages' permission in this channel." };
            }
            if (!interaction.member.permissionsIn(channel).has(PermissionsBitField.Flags.ManageMessages)) {
                return { success: false, error: "You lack 'Manage Messages' permission to perform this action." };
            }

            if (!Array.isArray(messageIds) || messageIds.length === 0) {
                return { success: false, error: "No message IDs provided." };
            }

            if (messageIds.length > 100) {
                return { success: false, error: "Cannot bulk delete more than 100 messages at once." };
            }

            // Identify 14 day old messages using Snowflake timestamps to avoid individual fetches
            const twoWeeksAgo = Date.now() - (14 * 24 * 60 * 60 * 1000);
            const validIds = [];
            let oldCount = 0;

            for (const id of messageIds) {
                const timestamp = SnowflakeUtil.timestampFrom(id);
                if (timestamp > twoWeeksAgo) {
                    validIds.push(id);
                } else {
                    oldCount++;
                }
            }

            if (validIds.length === 0) {
                return { success: false, error: `All ${oldCount} provided messages were too old (14+ days) and cannot be bulk deleted by Discord limits.` };
            }

            const confirmed = await this.awaitConfirmation(interaction, `Bulk delete ${validIds.length} messages in #${channel.name}${oldCount > 0 ? ` (Ignoring ${oldCount} messages older than 14 days)` : ''}`);
            if (!confirmed) return { success: false, error: "User denied the action." };

            console.log(`[DISCORD] Bulk delete requested for ${validIds.length} messages`);
            const deleted = await channel.bulkDelete(validIds, true);
            console.log(`[DISCORD] Deleted ${deleted.size} messages`);

            return { 
                success: true, 
                deletedCount: deleted.size,
                ignoredOldCount: oldCount
            };
        } catch (error) {
            console.error(`[DISCORD] Bulk delete failed:`, error.message);
            return { success: false, error: error.message };
        }
    }

    async add_reaction(interaction, messageId, emoji) {
        try {
            const channel = interaction.channel;
            const msg = await channel.messages.fetch(messageId);
            if (!msg) return { success: false, error: "Message not found in the current channel." };

            await msg.react(emoji);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async assign_role(interaction, userId, roleId) {
        try {
            const confirmed = await this.awaitConfirmation(interaction, `Assign role ID ${roleId} to user ID ${userId}`);
            if (!confirmed) return { success: false, error: "User denied the action." };

            const member = await interaction.guild.members.fetch(userId);
            if (!member) return { success: false, error: "Member not found." };

            const role = await interaction.guild.roles.fetch(roleId);
            if (!role) return { success: false, error: "Role not found." };

            await member.roles.add(role);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async remove_role(interaction, userId, roleId) {
        try {
            const confirmed = await this.awaitConfirmation(interaction, `Remove role ID ${roleId} from user ID ${userId}`);
            if (!confirmed) return { success: false, error: "User denied the action." };

            const member = await interaction.guild.members.fetch(userId);
            if (!member) return { success: false, error: "Member not found." };

            const role = await interaction.guild.roles.fetch(roleId);
            if (!role) return { success: false, error: "Role not found." };

            await member.roles.remove(role);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async get_server_info(interaction) {
        try {
            const guild = interaction.guild;
            if (!guild) return { success: false, error: "Not in a server." };

            return {
                success: true,
                name: guild.name,
                id: guild.id,
                memberCount: guild.memberCount,
                ownerId: guild.ownerId,
                createdAt: guild.createdAt.toISOString()
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async get_member_info(interaction, userId) {
        try {
            const member = await interaction.guild.members.fetch(userId);
            if (!member) return { success: false, error: "Member not found." };

            return {
                success: true,
                id: member.id,
                displayName: member.displayName,
                username: member.user.username,
                joinedAt: member.joinedAt ? member.joinedAt.toISOString() : null,
                roles: member.roles.cache.map(r => ({ id: r.id, name: r.name }))
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Manually moderate a message content via the AI Moderation tool
     * @param {Object} interaction 
     * @param {string} content 
     */
    async moderate_message(interaction, content) {
        if (!content) return { success: false, error: "Content is required." };
        try {
            const modService = require('./moderation');
            const result = await modService.callAI(content);
            if (!result) return { success: false, error: "AI Moderation failed to return a valid response." };
            return {
                success: true,
                safe: result.safe,
                category: result.category,
                severity: result.severity,
                confidence: result.confidence,
                reason: result.reason
            };
        } catch (error) {
            console.error('moderate_message error:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = new DiscordActions();
