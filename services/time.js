/**
 * Service to retrieve current date and time information.
 * Uses the en-IN locale and Asia/Kolkata timezone as primary defaults.
 */
class TimeService {
    /**
     * Get the current date, time, and timezone metadata from the server clock.
     * @returns {object} Current date, time, and timezone information
     */
    getCurrentDateTime() {
        try {
            const dateObj = new Date();

            const formattedDate = new Intl.DateTimeFormat("en-IN", {
                timeZone: "Asia/Kolkata",
                dateStyle: "full"
            }).format(dateObj);

            const formattedTime = new Intl.DateTimeFormat("en-IN", {
                timeZone: "Asia/Kolkata",
                timeStyle: "long"
            }).format(dateObj);

            return {
                date: formattedDate,
                time: formattedTime,
                timezone: "Asia/Kolkata"
            };
        } catch (error) {
            console.error("Error formatting current date and time:", error);
            // Graceful fallback using basic Date functions if Intl formatting fails
            const now = new Date();
            return {
                date: now.toDateString(),
                time: now.toTimeString(),
                timezone: "Asia/Kolkata"
            };
        }
    }
}

module.exports = new TimeService();
