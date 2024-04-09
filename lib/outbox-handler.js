const fs = require('fs');
const { defaultInboxHandler } = require('../lib/inbox-handler');
const { dynamic_handler , sendNotification } = require('../lib/util');
const logger = require('../lib/util.js').getLogger();

async function handle_outbox(path,options) {
    options['notification_handler'] = 
        options['notification_handler'] ?? defaultNotificationHandler;
    const handler = dynamic_handler(options['outbox_handler'], defaultInboxHandler);
    console.log(handler);
    return await handler(path,options);
}

async function defaultNotificationHandler(path,options) {
    try {
        const json = fs.readFileSync(path, { encoding: 'utf-8'});
        const data = JSON.parse(json);
        const type  = data['type'];
        let inbox;

        if (data['target'] && data['target']['inbox']) {
            inbox = data['target']['inbox'];
        }
        else {
            throw new Error(`no target.inbox defined for ${path}`);
        }

        logger.info(`Sending ${type} to ${inbox}`);
        await sendNotification(inbox, data);
    }
    catch (e) {
        logger.error(e);
    }
}

module.exports = { 
    handle_outbox
};