const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');

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
            const channel = await interaction.client.channels.fetch(channelId);
            if (!channel) return { success: false, error: "Channel not found." };
            if (!channel.isTextBased()) return { success: false, error: "Channel is not text-based." };
            
            const sentMsg = await channel.send(message);
            return { success: true, messageId: sentMsg.id };
        } catch (error) {
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
}

module.exports = new DiscordActions();
