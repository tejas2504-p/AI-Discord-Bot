const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('moderation')
        .setDescription('Execute server moderation commands.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        // Subcommand: kick
        .addSubcommand(subcommand =>
            subcommand.setName('kick')
                .setDescription('Kick a member from the server.')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The member to kick')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for the kick')
                        .setRequired(false)))
        // Subcommand: ban
        .addSubcommand(subcommand =>
            subcommand.setName('ban')
                .setDescription('Ban a member from the server.')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The member to ban')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for the ban')
                        .setRequired(false))
                .addIntegerOption(option =>
                    option.setName('delete_messages')
                        .setDescription('Time period of messages to delete')
                        .setRequired(false)
                        .addChoices(
                            { name: 'Don\'t Delete Any', value: 0 },
                            { name: 'Previous 24 Hours', value: 86400 },
                            { name: 'Previous 7 Days', value: 604800 }
                        )))
        // Subcommand: timeout
        .addSubcommand(subcommand =>
            subcommand.setName('timeout')
                .setDescription('Timeout/Mute a member in the server.')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The member to timeout')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('duration')
                        .setDescription('Duration of the timeout')
                        .setRequired(true)
                        .addChoices(
                            { name: '60 Seconds', value: 60 },
                            { name: '5 Minutes', value: 300 },
                            { name: '10 Minutes', value: 600 },
                            { name: '1 Hour', value: 3600 },
                            { name: '1 Day', value: 86400 },
                            { name: '1 Week', value: 604800 }
                        ))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for the timeout')
                        .setRequired(false)))
        // Subcommand: purge
        .addSubcommand(subcommand =>
            subcommand.setName('purge')
                .setDescription('Bulk delete messages from the channel.')
                .addIntegerOption(option =>
                    option.setName('amount')
                        .setDescription('Number of messages to delete (1-100)')
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(100))),
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        await interaction.deferReply({ ephemeral: true });

        try {
            if (subcommand === 'kick') {
                const user = interaction.options.getUser('user');
                const reason = interaction.options.getString('reason') || 'No reason provided';
                const member = await interaction.guild.members.fetch(user.id).catch(() => null);

                if (!member) {
                    await interaction.editReply('❌ That user is not in this server.');
                    return;
                }

                if (!member.kickable) {
                    await interaction.editReply('❌ I cannot kick this member. They may have a higher role than me.');
                    return;
                }

                await member.kick(reason);
                await interaction.editReply(`✅ **${user.tag}** has been kicked.\n**Reason:** ${reason}`);
            } 
            else if (subcommand === 'ban') {
                const user = interaction.options.getUser('user');
                const reason = interaction.options.getString('reason') || 'No reason provided';
                const deleteSecs = interaction.options.getInteger('delete_messages') || 0;
                
                // Check if user is in server to see if they are bannable
                const member = await interaction.guild.members.fetch(user.id).catch(() => null);
                if (member && !member.bannable) {
                    await interaction.editReply('❌ I cannot ban this member. They may have a higher role than me.');
                    return;
                }

                await interaction.guild.members.ban(user.id, { deleteMessageSeconds: deleteSecs, reason });
                await interaction.editReply(`✅ **${user.tag}** has been banned.\n**Reason:** ${reason}`);
            } 
            else if (subcommand === 'timeout') {
                const user = interaction.options.getUser('user');
                const duration = interaction.options.getInteger('duration');
                const reason = interaction.options.getString('reason') || 'No reason provided';
                const member = await interaction.guild.members.fetch(user.id).catch(() => null);

                if (!member) {
                    await interaction.editReply('❌ That user is not in this server.');
                    return;
                }

                if (!member.manageable) {
                    await interaction.editReply('❌ I cannot timeout this member.');
                    return;
                }

                await member.timeout(duration * 1000, reason);
                await interaction.editReply(`✅ **${user.tag}** has been timed out for ${duration} seconds.\n**Reason:** ${reason}`);
            } 
            else if (subcommand === 'purge') {
                const amount = interaction.options.getInteger('amount');
                
                // Delete messages
                const deleted = await interaction.channel.bulkDelete(amount, true);
                
                await interaction.editReply(`✅ Successfully purged **${deleted.size}** messages (ignoring messages older than 14 days).`);
            }
        } catch (error) {
            console.error(`Error in moderation ${subcommand} command:`, error);
            await interaction.editReply(`❌ An error occurred while executing the ${subcommand} command.`);
        }
    },
};
