const databaseService = require('./database');

class ModerationService {
    constructor() {
        this.cache = new Map();
    }

    async analyzeMessage(message) {
        // Ignore very short messages, bots, and DMs
        if (!message.guild || message.author.bot || message.content.length <= 5) return;

        // Skip admins/mods to save tokens
        if (message.member && message.member.permissions.has('Administrator')) return;

        try {
            const analysis = await this.callAI(message.content);
            if (!analysis) return;

            if (!analysis.safe && analysis.confidence > 0.70) {
                let actionTaken = 'ignored';
                
                if (analysis.severity === 'low') {
                    // Just warn
                    await message.author.send(`⚠️ **Warning:** Your recent message in ${message.guild.name} was flagged for ${analysis.category}. Please adhere to the rules.`).catch(() => {});
                    actionTaken = 'warned';
                } 
                else if (analysis.severity === 'medium') {
                    // Delete and warn
                    await message.delete().catch(() => {});
                    await message.author.send(`🛑 **Message Deleted:** Your message in ${message.guild.name} was removed for ${analysis.category}.`).catch(() => {});
                    actionTaken = 'deleted';
                }
                else if (analysis.severity === 'high') {
                    // Delete and timeout (5 mins)
                    await message.delete().catch(() => {});
                    if (message.member.moderatable) {
                        await message.member.timeout(5 * 60 * 1000, `AI Auto-Mod: ${analysis.category}`).catch(() => {});
                        await message.author.send(`⛔ **Timed Out:** You have been timed out for 5 minutes in ${message.guild.name} due to high-severity ${analysis.category}.`).catch(() => {});
                        actionTaken = 'timeout';
                    } else {
                        actionTaken = 'deleted';
                    }
                }

                // Log to MongoDB
                const log = new databaseService.ModerationLog({
                    userId: message.author.id,
                    guildId: message.guild.id,
                    messageId: message.id,
                    content: message.content.substring(0, 500), // store up to 500 chars
                    category: analysis.category,
                    severity: analysis.severity,
                    confidence: analysis.confidence,
                    actionTaken: actionTaken
                });
                await log.save();
                
                console.log(`[AutoMod] Flagged user ${message.author.tag} for ${analysis.category} (${analysis.severity}). Action: ${actionTaken}`);
            }
        } catch (error) {
            console.error('[AutoMod] Error analyzing message:', error.message);
        }
    }

    async callAI(content) {
        const prompt = `Analyze the following message for toxicity, spam, harassment, hate speech, or abuse.
Return ONLY a raw JSON object with the following schema, and no other text:
{
  "safe": boolean, // false if it violates rules
  "category": "spam" | "toxic" | "harassment" | "hate" | "none",
  "severity": "low" | "medium" | "high" | "none",
  "confidence": number, // 0.0 to 1.0
  "reason": "short explanation"
}

Message to analyze:
"${content}"`;

        try {
            // Use Groq for fast, cheap moderation
            const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
                },
                body: JSON.stringify({
                    model: 'groq/compound', // or a valid groq model
                    messages: [{ role: 'user', content: prompt }],
                    response_format: { type: "json_object" },
                    temperature: 0.1,
                    max_tokens: 150
                })
            });

            if (!res.ok) {
                console.error('[AutoMod] Groq API failed with status:', res.status, await res.text());
                // If Groq fails (e.g. model not found), fallback to Gemini
                return this.callAIFallback(prompt);
            }

            const data = await res.json();
            const text = data.choices[0].message.content;
            return JSON.parse(text);
        } catch (e) {
            console.error('[AutoMod] Groq parsing/execution error:', e);
            return this.callAIFallback(prompt);
        }
    }

    async callAIFallback(prompt) {
        try {
            const { GoogleGenerativeAI } = require('@google/generative-ai');
            const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
            const result = await model.generateContent({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: {
                    responseMimeType: "application/json"
                }
            });
            const text = result.response.text();
            return JSON.parse(text);
        } catch (e) {
            return null; // Both failed, just ignore
        }
    }
}

module.exports = new ModerationService();
