const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const aiService = require('../services/ai');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('generate-image')
        .setDescription('Generate an image using Imagen AI.')
        .addStringOption(option =>
            option.setName('prompt')
                .setDescription('The description of the image to generate')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('aspect_ratio')
                .setDescription('The aspect ratio of the image (default is 1:1)')
                .setRequired(false)
                .addChoices(
                    { name: '1:1 (Square)', value: '1:1' },
                    { name: '16:9 (Widescreen)', value: '16:9' },
                    { name: '9:16 (Portrait)', value: '9:16' },
                    { name: '4:3 (Standard)', value: '4:3' },
                    { name: '3:4 (Tall)', value: '3:4' }
                )),
    async execute(interaction) {
        const prompt = interaction.options.getString('prompt');
        const aspectRatio = interaction.options.getString('aspect_ratio') || '1:1';
        
        // Defer reply as image generation can take a few seconds
        await interaction.deferReply();

        try {
            const imageBuffer = await aiService.generateImage(prompt, { aspectRatio });
            
            const attachment = new AttachmentBuilder(imageBuffer, { name: 'generated-image.png' });
            
            await interaction.editReply({
                content: `🎨 **Generated image for:** "${prompt}" (Aspect Ratio: ${aspectRatio})`,
                files: [attachment]
            });
        } catch (error) {
            console.error('Error in generate-image command:', error);
            await interaction.editReply(error.message || 'An error occurred while generating your image.');
        }
    },
};
