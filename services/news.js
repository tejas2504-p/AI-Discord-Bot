/**
 * Service to retrieve current news headlines.
 * Parses public Google News RSS feeds without external dependencies.
 */
class NewsService {
    /**
     * Get recent news articles matching a search topic.
     * @param {string} topic The topic or query to search for
     * @returns {Promise<Array>} List of article objects
     */
    async getNews(topic) {
        const query = topic && topic.trim() !== '' ? topic.trim() : 'world news';
        const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;

        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                },
                signal: AbortSignal.timeout(6000) // 6 second timeout
            });

            if (!response.ok) {
                throw new Error(`News feed returned status: ${response.status}`);
            }

            const xmlText = await response.text();
            return this.parseRSS(xmlText).slice(0, 5); // Return top 5 articles
        } catch (error) {
            console.error(`NewsService Error for query "${topic}":`, error);
            throw new Error(`Failed to retrieve news articles for "${topic}". Please try again later.`);
        }
    }

    /**
     * Simple keyless regex-based XML RSS parser to avoid heavy package dependencies
     */
    parseRSS(xml) {
        const articles = [];
        const itemRegex = /<item>([\s\S]*?)<\/item>/g;
        const titleRegex = /<title>([\s\S]*?)<\/title>/;
        const linkRegex = /<link>([\s\S]*?)<\/link>/;
        const dateRegex = /<pubDate>([\s\S]*?)<\/pubDate>/;
        const sourceRegex = /<source[^>]*>([\s\S]*?)<\/source>/;

        let match;
        while ((match = itemRegex.exec(xml)) !== null) {
            const itemContent = match[1];
            
            const titleMatch = titleRegex.exec(itemContent);
            const linkMatch = linkRegex.exec(itemContent);
            const dateMatch = dateRegex.exec(itemContent);
            const sourceMatch = sourceRegex.exec(itemContent);

            if (titleMatch && linkMatch) {
                let title = this.cleanEntities(titleMatch[1]);
                const link = linkMatch[1].trim();
                const pubDate = dateMatch ? dateMatch[1].trim() : 'N/A';
                const source = sourceMatch ? this.cleanEntities(sourceMatch[1]) : 'Unknown';

                // Strip the source suffix from Google News titles if present (e.g. "Title - Source")
                const suffixIndex = title.lastIndexOf(` - ${source}`);
                if (suffixIndex !== -1) {
                    title = title.substring(0, suffixIndex).trim();
                }

                articles.push({
                    title,
                    link,
                    pubDate: new Date(pubDate).toLocaleDateString() || pubDate,
                    source
                });
            }
        }

        return articles;
    }

    /**
     * Utility to decode XML character entities
     */
    cleanEntities(str) {
        return str
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1')
            .trim();
    }
}

module.exports = new NewsService();
