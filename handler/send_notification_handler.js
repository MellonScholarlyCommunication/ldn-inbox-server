const logger = require('../lib/util.js').getLogger();
const { sendNotification , parseAsJSON } = require('../lib/util.js');

/**
 * Demonstration notification handler that sends a notification to a
 * target inbox. 
 */
async function handle({path,options}) {
    try {
        const data = parseAsJSON(path);
        const type = data['type'];
        let inbox;

        if (data['target'] && data['target']['inbox']) {
            inbox = data['target']['inbox'];
        }
        else {
            throw new Error(`no target.inbox defined for ${path}`);
        }

        logger.info(`Sending ${type} to ${inbox}`);
        await sendNotification(inbox, data);

        return { path, options, success: true };
    }
    catch (e) {
        logger.error(e);
        return { path, options, success: false };
    }
}

module.exports = { handle };