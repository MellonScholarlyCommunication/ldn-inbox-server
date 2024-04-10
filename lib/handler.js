const fs = require('fs');
const lockfile = require('proper-lockfile');
const { dynamic_handler , sendNotification } = require('../lib/util');
const logger = require('../lib/util.js').getLogger();

async function handle_inbox(path,options) {
    if (! options['notification_handler']) {
        logger.error(`need a notification_handler`);
    }
    const handler = dynamic_handler(options['inbox_handler'],defaultInboxHandler);
    return await handler(path,options);
}

async function defaultInboxHandler(path,options) {
    logger.info(`[${path}]`);

    const handler = dynamic_handler(options['notification_handler'],null);

    fs.readdir(path, (err,files) => {
        files.forEach( (file) => {
            const fullPath = `${path}/${file}`;
            if (file.match("^\\..*$")) {
                // Ignore
            }
            else if (file.match("^.*\\.jsonld$")) {
                // Process
                lockfile.lock(fullPath)
                    .then( async (release) => {
                        await handler(fullPath,options);
                        return release();
                    })
                    .catch( (e) => {
                        logger.error(e);
                        logger.warn(`${fullPath} is locked`);
                    })
                    .finally( () => {
                        logger.debug(`removing ${fullPath}`);
                        fs.unlinkSync(fullPath);
                    });
            }
            else {
                fs.unlinkSync(fullPath);
            }
        });
    });
}

async function defaultSendNotificationHandler(path,options) {
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
    handle_inbox,
    defaultInboxHandler ,
    defaultSendNotificationHandler
};