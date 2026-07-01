const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const databaseService = require('../services/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-logs')
        .setDescription('Set the channel where server action logs will be sent.')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The log channel')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildText))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(interaction) {
        const channel = interaction.options.getChannel('channel');
        const guildId = interaction.guild.id;

        await interaction.deferReply();

        try {
            await databaseService.GuildConfig.findOneAndUpdate(
                { guildId },
                { logChannelId: channel.id },
                { upsert: true, new: true }
            );

            await interaction.editReply(`✅ Audit logs channel successfully set to ${channel}.`);
        } catch (error) {
            console.error('Error setting log channel:', error);
            await interaction.editReply('❌ An error occurred while saving the configuration.');
        }
    },
};
