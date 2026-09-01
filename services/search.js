require('dotenv').config();

/**
 * Service to interact with the Tavily Web Search API.
 * Uses native fetch to execute searches and retrieve search results.
 */
class SearchService {
    constructor() {
        this.apiKey = process.env.TAVILY_API_KEY;
    }

    /**
     * Search the web for a given query.
     * @param {string} query The search query string
     * @param {object} options Options including maxResults and searchDepth
     * @returns {Promise<Array>} List of search result objects { title, url, content }
     */
    async search(query, options = {}) {
        if (!this.apiKey || this.apiKey === 'your_tavily_api_key_here') {
            throw new Error("Tavily search feature is not configured. Please add a valid `TAVILY_API_KEY` to your `.env` file.");
        }

        if (!query || query.trim() === '') {
            throw new Error("Search query cannot be empty.");
        }

        const url = 'https://api.tavily.com/search';
        const payload = {
            query: query.trim(),
            max_results: options.maxResults || 3,
            search_depth: options.searchDepth || 'basic',
            include_answer: false,
            include_images: false,
            include_raw_content: false
        };

        let attempts = 0;
        const maxAttempts = 3;
        let backoffMs = 1000;

        while (attempts < maxAttempts) {
            attempts++;
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.apiKey}`
                    },
                    body: JSON.stringify(payload),
                    signal: AbortSignal.timeout(8000) // 8 second timeout
                });

                if (response.status === 429 && attempts < maxAttempts) {
                    console.warn(`Tavily API returned 429 (Rate Limit). Retrying attempt ${attempts} in ${backoffMs}ms...`);
                    await new Promise(resolve => setTimeout(resolve, backoffMs));
                    backoffMs *= 2;
                    continue;
                }

                if (!response.ok) {
                    const errData = await response.json().catch(() => ({}));
                    console.error('Tavily API error status:', response.status, errData);
                    
                    if (response.status === 401 || response.status === 403) {
                        throw new Error("Unauthorized: Please check if your `TAVILY_API_KEY` is correct and active.");
                    } else if (response.status === 429) {
                        throw new Error("Rate limit exceeded for Tavily Search. Please try again in a moment.");
                    } else {
                        throw new Error(`Error from Tavily API: Status ${response.status}.`);
                    }
                }

                const data = await response.json();
                
                if (data && Array.isArray(data.results)) {
                    return data.results.map(item => ({
                        title: item.title || 'Untitled',
                        url: item.url || '',
                        content: item.content ? item.content.substring(0, 800) : ''
                    }));
                }

                throw new Error("Received an unexpected response format from the Tavily search service.");
            } catch (error) {
                if (attempts >= maxAttempts || error.message.includes("Unauthorized") || error.message.includes("Rate limit")) {
                    console.error('SearchService Error:', error);
                    throw error;
                }

                console.warn(`Network/timeout error on Tavily search attempt ${attempts}. Retrying in ${backoffMs}ms...`, error);
                await new Promise(resolve => setTimeout(resolve, backoffMs));
                backoffMs *= 2;
            }
        }
    }
}

const searchInstance = new SearchService();

async function webSearch(query) {
    return await searchInstance.search(query);
}

module.exports = searchInstance;
module.exports.webSearch = webSearch;
