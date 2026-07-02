/**
 * Service to fetch real-time weather details.
 * Uses wttr.in JSON API (?format=j1) for free, keyless queries.
 */
class WeatherService {
    /**
     * Get weather information for a specific location.
     * @param {string} location The city or region name
     * @returns {Promise<object>} The parsed weather details
     */
    async getWeather(location) {
        if (!location || location.trim() === '') {
            throw new Error("Please specify a location name.");
        }

        const query = encodeURIComponent(location.trim());
        const url = `https://wttr.in/${query}?format=j1`;

        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; DiscordBot/1.0)'
                },
                signal: AbortSignal.timeout(6000) // 6 second timeout
            });

            if (!response.ok) {
                throw new Error(`Weather service returned status: ${response.status}`);
            }

            const data = await response.json();
            if (!data || !data.current_condition || data.current_condition.length === 0) {
                throw new Error("Could not parse weather details for this location.");
            }

            const current = data.current_condition[0];
            const area = data.nearest_area ? data.nearest_area[0] : null;
            const areaName = area && area.areaName ? area.areaName[0].value : location;
            const region = area && area.region ? area.region[0].value : '';
            const country = area && area.country ? area.country[0].value : '';
            const locationString = `${areaName}${region ? ', ' + region : ''}${country ? ', ' + country : ''}`;

            // Parse 3 days forecast briefly
            const forecastList = [];
            if (data.weather && data.weather.length > 0) {
                for (let i = 0; i < Math.min(3, data.weather.length); i++) {
                    const day = data.weather[i];
                    forecastList.push({
                        date: day.date,
                        maxTempC: day.maxtempC,
                        minTempC: day.mintempC,
                        avgTempC: day.avgtempC,
                        condition: day.hourly && day.hourly.length > 4 ? day.hourly[4].weatherDesc[0].value : 'Unknown'
                    });
                }
            }

            return {
                location: locationString,
                tempC: current.temp_C,
                tempF: current.temp_F,
                feelsLikeC: current.FeelsLikeC,
                feelsLikeF: current.FeelsLikeF,
                condition: current.weatherDesc && current.weatherDesc.length > 0 ? current.weatherDesc[0].value : 'Unknown',
                humidity: current.humidity,
                windspeedKmh: current.windspeedKmh,
                winddir16Point: current.winddir16Point,
                precipMM: current.precipMM,
                forecast: forecastList
            };
        } catch (error) {
            console.error(`WeatherService Error for query "${location}":`, error);
            // Fallback description
            throw new Error(`Failed to fetch weather for "${location}". Please make sure the name is correct or try again later.`);
        }
    }
}

module.exports = new WeatherService();
