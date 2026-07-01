const { SlashCommandBuilder } = require('discord.js');
const aiService = require('../services/ai');
const databaseService = require('../services/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('interview')
        .setDescription('Conduct an interactive mock interview with AI feedback.')
        .addStringOption(option =>
            option.setName('topic')
                .setDescription('The job role or topic of the interview (starts a new session)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('difficulty')
                .setDescription('The level of the role (Junior, Mid-Level, Senior; default is Mid-Level)')
                .setRequired(false)
                .addChoices(
                    { name: 'Junior', value: 'Junior' },
                    { name: 'Mid-Level', value: 'Mid-Level' },
                    { name: 'Senior', value: 'Senior' }
                ))
        .addStringOption(option =>
            option.setName('response')
                .setDescription('Your answer to the interviewer\'s current question')
                .setRequired(false)),
    async execute(interaction) {
        const topic = interaction.options.getString('topic');
        const difficulty = interaction.options.getString('difficulty') || 'Mid-Level';
        const responseText = interaction.options.getString('response');

        await interaction.deferReply();

        const historyKey = `interview:${interaction.user.id}`;

        // Case 1: Start a new interview
        if (topic) {
            const initialPrompt = `You are a professional technical interviewer conducting a mock interview for a ${difficulty} level candidate on the topic: "${topic}". 
Your goal is to conduct a short 3-question interview.
First, introduce yourself briefly, explain the guidelines, and ask the first question.
Only ask ONE question at a time. Keep it brief. Do not output anything else besides the greeting, the instructions, and the first question.`;

            try {
                const aiResponse = await aiService.generateContent(initialPrompt);
                
                const session = {
                    topic,
                    difficulty,
                    questionCount: 1,
                    maxQuestions: 3,
                    history: [
                        {
                            role: 'user',
                            parts: [{ text: initialPrompt }]
                        },
                        {
                            role: 'model',
                            parts: [{ text: aiResponse }]
                        }
                    ]
                };

                await databaseService.set(historyKey, session);

                await interaction.editReply(`🎙️ **Mock Interview Started!**\n**Topic:** ${topic} | **Difficulty:** ${difficulty}\n\n${aiResponse}\n\n*Reply using: \`/interview response: \"your answer here\"\`*`);
            } catch (error) {
                console.error('Error starting interview:', error);
                await interaction.editReply('An error occurred while starting the interview session.');
            }
            return;
        }

        // Case 2: User is answering a question
        if (responseText) {
            let session = await databaseService.get(historyKey);
            if (!session) {
                await interaction.editReply('❌ You do not have an active interview session. Start one using `/interview topic: "your topic"`');
                return;
            }

            session.questionCount += 1;
            
            let systemPrompt = '';
            if (session.questionCount > session.maxQuestions) {
                systemPrompt = `Evaluate the candidate's last answer, then summarize their performance throughout the interview, highlighting strengths and areas of improvement (constructive feedback). Conclude the interview. Do not ask any more questions.`;
            } else {
                systemPrompt = `Evaluate the candidate's last answer briefly (be encouraging but honest), and ask the next question (Question ${session.questionCount} of ${session.maxQuestions}). Only ask ONE question. Do not output anything else.`;
            }

            // Append candidate's answer to history
            session.history.push({
                role: 'user',
                parts: [{ text: `Candidate Answer: "${responseText}"\n\n[System directive for next response: ${systemPrompt}]` }]
            });

            try {
                const aiResponse = await aiService.generateContent('', session.history);

                // Append model's response to history
                session.history.push({
                    role: 'model',
                    parts: [{ text: aiResponse }]
                });

                if (session.questionCount > session.maxQuestions) {
                    // Interview is over - clear the session from db
                    await databaseService.delete(historyKey);
                    await interaction.editReply(`🏁 **Interview Concluded!**\n\n📝 **Your Answer:** "${responseText}"\n\n💬 **Feedback & Evaluation:**\n${aiResponse}`);
                } else {
                    // Update session
                    await databaseService.set(historyKey, session);
                    await interaction.editReply(`🎙️ **Mock Interview (Question ${session.questionCount}/${session.maxQuestions})**\n\n📝 **Your Answer:** "${responseText}"\n\n💬 **Interviewer:**\n${aiResponse}\n\n*Reply using: \`/interview response: \"your answer here\"\`*`);
                }
            } catch (error) {
                console.error('Error in interview response:', error);
                await interaction.editReply('An error occurred while processing your interview response.');
            }
            return;
        }

        // Case 3: Command run without any options
        let session = await databaseService.get(historyKey);
        if (session) {
            const lastQuestionPart = session.history[session.history.length - 1];
            const lastQuestion = lastQuestionPart ? lastQuestionPart.parts[0].text : 'No active question found.';
            await interaction.editReply(`🎙️ **Active Interview Session Found!**\n**Topic:** ${session.topic} | **Question:** ${session.questionCount}/${session.maxQuestions}\n\n💬 **Interviewer's Last Question:**\n${lastQuestion}\n\n*Reply using: \`/interview response: \"your answer here\"\`*`);
        } else {
            await interaction.editReply('❓ Start a new interview using `/interview topic: "your topic"` (e.g. `Javascript`, `Sales representative`).');
        }
    }
};
