const logger = require('../../lib/util.js').getLogger();
const { sendNotification } = require('../../lib/util.js');

/**
 * Demonstration notification handler that sends a notification to a
 * target inbox. 
 */
async function handle({path,options,config,notification}) {
    try {
        const type = notification['type'];
        let inbox;

        if (notification['target'] && notification['target']['inbox']) {
            inbox = notification['target']['inbox'];
        }
        else {
            throw new Error(`no target.inbox defined for ${path}`);
        }

        logger.info(`Sending ${type} to ${inbox}`);

        if (process.env.DEMO_MODE) {
            logger.info(`**demo mode** I will not do anything`);
            return { path, options, success: true }; 
        }
        else {
            await sendNotification(inbox, notification);
        }

        return { path, options, success: true };
    }
    catch (e) {
        logger.error(e);
        return { path, options, success: false };
    }
}

module.exports = { handle };