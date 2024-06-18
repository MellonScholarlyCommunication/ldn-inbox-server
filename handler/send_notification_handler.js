const fs = require('fs');
const logger = require('../lib/util.js').getLogger();
const { sendNotification } = require('../lib/util.js');

/**
 * Demonstration notification handler that sends a notification to a
 * target inbox. 
 */
async function handle({path,options}) {
    try {
        const json = fs.readFileSync(path, { encoding: 'utf-8'});
        const data = JSON.parse(json);
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