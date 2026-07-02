/**
 * Service to retrieve current sports scores, fixtures, and news headlines.
 * Parses BBC Sports Football and general Sports RSS feeds without external dependencies.
 */
class SportsService {
    /**
     * Get sports news, scores, or fixtures matching a search query.
     * @param {string} query The team name or sport to search for (e.g., Chelsea, Football, Cricket)
     * @returns {Promise<Array>} List of sports article/score items
     */
    async getSports(query) {
        const searchTerm = query && query.trim() !== '' ? query.trim().toLowerCase() : '';
        
        // Fetch football-specific and general sports feeds in parallel
        const feeds = [
            'https://feeds.bbci.co.uk/sport/football/rss.xml',
            'https://feeds.bbci.co.uk/sport/rss.xml'
        ];

        try {
            const fetchPromises = feeds.map(url =>
                fetch(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
                    },
                    signal: AbortSignal.timeout(6000)
                }).then(res => res.ok ? res.text() : '')
            );

            const xmlContents = await Promise.all(fetchPromises);
            let allItems = [];

            for (const xml of xmlContents) {
                if (xml) {
                    allItems.push(...this.parseRSS(xml));
                }
            }

            // Remove duplicate items (by link)
            const uniqueItems = [];
            const seenLinks = new Set();
            for (const item of allItems) {
                if (!seenLinks.has(item.link)) {
                    seenLinks.add(item.link);
                    uniqueItems.push(item);
                }
            }

            // Filter items based on user search term
            if (searchTerm) {
                const filtered = uniqueItems.filter(item =>
                    item.title.toLowerCase().includes(searchTerm) ||
                    item.description.toLowerCase().includes(searchTerm)
                );
                return filtered.slice(0, 5);
            }

            return uniqueItems.slice(0, 5); // Return trending sports if no search term
        } catch (error) {
            console.error(`SportsService Error for query "${query}":`, error);
            throw new Error(`Failed to retrieve sports details for "${query}". Please try again later.`);
        }
    }

    /**
     * Parse standard RSS feeds
     */
    parseRSS(xml) {
        const items = [];
        const itemRegex = /<item>([\s\S]*?)<\/item>/g;
        const titleRegex = /<title>([\s\S]*?)<\/title>/;
        const linkRegex = /<link>([\s\S]*?)<\/link>/;
        const descRegex = /<description>([\s\S]*?)<\/description>/;
        const dateRegex = /<pubDate>([\s\S]*?)<\/pubDate>/;

        let match;
        while ((match = itemRegex.exec(xml)) !== null) {
            const itemContent = match[1];
            
            const titleMatch = titleRegex.exec(itemContent);
            const linkMatch = linkRegex.exec(itemContent);
            const descMatch = descRegex.exec(itemContent);
            const dateMatch = dateRegex.exec(itemContent);

            if (titleMatch && linkMatch) {
                const title = this.cleanEntities(titleMatch[1]);
                const link = linkMatch[1].trim();
                const description = descMatch ? this.cleanEntities(descMatch[1]) : '';
                const pubDate = dateMatch ? dateMatch[1].trim() : 'N/A';

                items.push({
                    title,
                    link,
                    description,
                    pubDate: new Date(pubDate).toLocaleDateString() || pubDate
                });
            }
        }

        return items;
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

module.exports = new SportsService();
