const aiService = require('./ai');
const weatherService = require('./weather');
const newsService = require('./news');
const sportsService = require('./sports');
const financeService = require('./finance');
const searchService = require('./search');

/**
 * Intelligent Query Router.
 * Uses Gemini to classify prompts and routes them to real-time APIs or AI reasoning.
 */
class RouterService {
    /**
     * Route the prompt to the correct handler and return the conversational response.
     * @param {string} prompt The user's query
     * @param {Array} history Conversation history
     * @returns {Promise<string>} Conversational formatted response
     */
    async route(prompt, history = []) {
        if (!prompt || prompt.trim() === '') {
            throw new Error("Empty prompt provided.");
        }

        console.log(`[Router] Routing query: "${prompt}"`);

        // Ask Gemini to classify the prompt
        const routingSystemPrompt = `You are an intelligent query router. Analyze the user's question and classify it into one of the following categories:
- "weather": queries asking about current weather, temperature, rain, forecast, or climate of a specific city/location.
- "news": queries asking about current news headlines, articles, or what happened recently regarding a topic.
- "sports": football matches, scores, fixtures, standings, or sports news.
- "finance": queries asking about current stock ticker prices, share values, index rates, or cryptocurrency prices (e.g. AAPL, BTC, Bitcoin, stocks).
- "search": queries asking about general web search, current facts, recent events, definitions of new terms, or anything requiring live internet search that does not fit into specific categories like weather, news, sports, or finance.
- "general": conversational banter, math, coding, general knowledge, explanations, translation, or questions that don't need real-time web stats.

You must output ONLY valid, raw JSON with the following structure:
{
  "type": "weather" | "news" | "sports" | "finance" | "search" | "general",
  "query": "the search term, city name, stock ticker, sports team, or search query extracted from the prompt"
}
Do not write explanations, markdown comments, or code blocks. Just return the JSON string.`;

        try {
            // Call Gemini directly for classification
            const classificationText = await aiService.generateContent(`${routingSystemPrompt}\n\nUser Question: "${prompt}"`);
            
            let classification = { type: 'general', query: prompt };
            try {
                const cleanedText = classificationText.replace(/```json|```/g, '').trim();
                classification = JSON.parse(cleanedText);
                console.log(`[Router] Classified query as: ${classification.type} (Query: "${classification.query}")`);
            } catch (jsonErr) {
                console.warn(`[Router] Failed to parse classification JSON: "${classificationText}". Falling back to general reasoning.`);
            }

            // Route to appropriate service
            switch (classification.type) {
                case 'weather': {
                    try {
                        const weatherData = await weatherService.getWeather(classification.query);
                        const formattingPrompt = `You are an AI assistant. The user asked: "${prompt}".
Here is the live weather data we fetched for "${classification.query}":
${JSON.stringify(weatherData)}

Format this data into a friendly, helpful, conversational response. Mention current temperature, wind speed, humidity, and the 3-day forecast if available. Keep it readable.`;
                        return await aiService.generateContent(formattingPrompt);
                    } catch (e) {
                        console.warn('[Router] Weather service failed, falling back to general:', e);
                        break; // Fallback to general AI response
                    }
                }

                case 'finance': {
                    try {
                        const financeData = await financeService.getQuote(classification.query);
                        const formattingPrompt = `You are an AI assistant. The user asked: "${prompt}".
Here is the live financial quote data we fetched for "${classification.query}":
${JSON.stringify(financeData)}

Format this data into a professional yet conversational response. Report the price, currency, exchange, change, and change percent. If it's a crypto token, represent it clearly. Explain the date/time of the quote.`;
                        return await aiService.generateContent(formattingPrompt);
                    } catch (e) {
                        console.warn('[Router] Finance service failed, falling back to general:', e);
                        break;
                    }
                }

                case 'news': {
                    try {
                        const newsData = await newsService.getNews(classification.query);
                        if (newsData.length === 0) break;
                        
                        const formattingPrompt = `You are an AI assistant. The user asked: "${prompt}".
Here are the live news headlines we fetched for "${classification.query}":
${JSON.stringify(newsData)}

Format these headlines into a clean, summaries list. Provide the title, date, and source of each article. Keep it concise, professional, and link the articles using markdown [Title](Link) links.`;
                        return await aiService.generateContent(formattingPrompt);
                    } catch (e) {
                        console.warn('[Router] News service failed, falling back to general:', e);
                        break;
                    }
                }

                case 'sports': {
                    try {
                        const sportsData = await sportsService.getSports(classification.query);
                        if (sportsData.length === 0) break;

                        const formattingPrompt = `You are an AI assistant. The user asked: "${prompt}".
Here are the live sports updates we fetched for "${classification.query}":
${JSON.stringify(sportsData)}

Format these details into an engaging sports summary. Report recent results, headlines, or fixtures, linking the articles with markdown [Title](Link) links.`;
                        return await aiService.generateContent(formattingPrompt);
                    } catch (e) {
                        console.warn('[Router] Sports service failed, falling back to general:', e);
                        break;
                    }
                }

                case 'search': {
                    try {
                        const searchResults = await searchService.search(classification.query);
                        if (searchResults.length === 0) break;

                        const formattingPrompt = `You are an AI assistant. The user asked: "${prompt}".
Here is the live web search data we fetched for "${classification.query}":
${JSON.stringify(searchResults)}

Format this search data into a highly informative, conversational response. Synthesize the findings, highlight key facts, and link to the sources using markdown [Title](Link) links. Keep it engaging and easy to read.`;
                        return await aiService.generateContent(formattingPrompt);
                    } catch (e) {
                        console.warn('[Router] Search service failed, falling back to general:', e);
                        break;
                    }
                }

                case 'general':
                default:
                    break;
            }

            // Fallback to standard AI generation with conversation history
            return await aiService.generateContent(prompt, history);
        } catch (error) {
            console.error('[Router] Routing Error:', error);
            // Fallback to basic AI answer
            return await aiService.generateContent(prompt, history);
        }
    }
}

module.exports = new RouterService();
