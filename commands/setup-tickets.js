const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const databaseService = require('../services/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-tickets')
        .setDescription('Configure the support tickets system and post the creation panel.')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel where the ticket creation panel will be posted')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildText))
        .addChannelOption(option =>
            option.setName('category')
                .setDescription('The category channel under which tickets will be created')
                .setRequired(false)
                .addChannelTypes(ChannelType.GuildCategory))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(interaction) {
        const channel = interaction.options.getChannel('channel');
        const category = interaction.options.getChannel('category');
        const guildId = interaction.guild.id;

        await interaction.deferReply();

        try {
            // Update database configuration
            await databaseService.GuildConfig.findOneAndUpdate(
                { guildId },
                { ticketCategoryId: category ? category.id : null },
                { upsert: true, new: true }
            );

            // Construct Ticket Panel Embed
            const ticketPanelEmbed = new EmbedBuilder()
                .setTitle('🎫 Support Tickets')
                .setDescription('Need help? Click the button below to open a private support ticket and chat with our team.')
                .setColor('#0099ff')
                .setFooter({ text: `${interaction.guild.name} Support` })
                .setTimestamp();

            const createButton = new ButtonBuilder()
                .setCustomId('ticket_create')
                .setLabel('Create Ticket')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('✉️');

            const row = new ActionRowBuilder().addComponents(createButton);

            // Send panel to the channel
            await channel.send({
                embeds: [ticketPanelEmbed],
                components: [row]
            });

            await interaction.editReply(`✅ Support tickets system successfully configured! Panel posted in ${channel}.`);
        } catch (error) {
            console.error('Error configuring tickets:', error);
            await interaction.editReply('❌ An error occurred while setting up the ticketing system.');
        }
    },
};
