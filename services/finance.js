/**
 * Service to fetch real-time stock and cryptocurrency quotes.
 * Integrates with Yahoo Finance public chart API.
 */
class FinanceService {
    /**
     * Get stock or cryptocurrency quote.
     * @param {string} symbol The stock ticker or crypto token symbol (e.g. AAPL, BTC, ETH)
     * @returns {Promise<object>} The financial quote details
     */
    async getQuote(symbol) {
        if (!symbol || symbol.trim() === '') {
            throw new Error("Please specify a stock ticker or cryptocurrency symbol (e.g. AAPL, BTC).");
        }

        let querySymbol = symbol.trim().toUpperCase();

        // Common crypto symbol mapping to Yahoo Finance format (BTC -> BTC-USD)
        const commonCryptos = ['BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'DOGE', 'LTC', 'LINK', 'DOT', 'SHIB', 'AVAX', 'MATIC', 'BNB'];
        if (commonCryptos.includes(querySymbol)) {
            querySymbol = `${querySymbol}-USD`;
        }

        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${querySymbol}`;

        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                },
                signal: AbortSignal.timeout(6000) // 6 second timeout
            });

            if (!response.ok) {
                // If it failed and we appended -USD, maybe it is a stock symbol that happens to share a crypto ticker
                if (querySymbol.endsWith('-USD')) {
                    const retrySymbol = symbol.trim().toUpperCase();
                    return await this.fetchDirect(retrySymbol);
                }
                throw new Error(`Finance API returned status: ${response.status}`);
            }

            return await this.parseChartResponse(response, querySymbol);
        } catch (error) {
            console.error(`FinanceService Error for symbol "${symbol}":`, error);
            throw new Error(`Could not retrieve quote for symbol "${symbol}". Please check if the ticker symbol is correct.`);
        }
    }

    /**
     * Direct chart fetch helper (without crypto suffix)
     */
    async fetchDirect(symbol) {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`;
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            signal: AbortSignal.timeout(6000)
        });
        if (!response.ok) {
            throw new Error(`Finance API retry returned status: ${response.status}`);
        }
        return await this.parseChartResponse(response, symbol);
    }

    /**
     * Parse Yahoo Finance chart response structure
     */
    async parseChartResponse(response, symbol) {
        const data = await response.json();
        
        if (
            !data ||
            !data.chart ||
            !data.chart.result ||
            data.chart.result.length === 0 ||
            !data.chart.result[0].meta
        ) {
            throw new Error("Could not parse quote data from finance service.");
        }

        const meta = data.chart.result[0].meta;
        const currentPrice = meta.regularMarketPrice;
        const prevClose = meta.chartPreviousClose;
        const change = currentPrice - prevClose;
        const changePercent = prevClose ? (change / prevClose) * 100 : 0;

        return {
            symbol: meta.symbol || symbol,
            currency: meta.currency || 'USD',
            price: currentPrice,
            previousClose: prevClose,
            change: parseFloat(change.toFixed(4)),
            changePercent: parseFloat(changePercent.toFixed(2)),
            exchange: meta.exchangeName || 'N/A',
            marketState: meta.scale ? 'Open' : 'N/A',
            timestamp: new Date(meta.regularMarketTime * 1000)
        };
    }
}

module.exports = new FinanceService();
