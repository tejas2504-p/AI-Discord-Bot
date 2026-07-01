const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const databaseService = require('../services/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-welcome')
        .setDescription('Set the channel where welcome messages will be sent.')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The welcome channel')
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
                { welcomeChannelId: channel.id },
                { upsert: true, new: true }
            );

            await interaction.editReply(`✅ Welcome messages channel successfully set to ${channel}.`);
        } catch (error) {
            console.error('Error setting welcome channel:', error);
            await interaction.editReply('❌ An error occurred while saving the configuration.');
        }
    },
};
