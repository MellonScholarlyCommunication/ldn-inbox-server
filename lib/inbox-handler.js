const fs = require('fs');
const logger = require('../lib/util.js').getLogger();

async function handle_inbox(path,options) {
    const handler = require_inbox_hander(options['inbox_handler']);
    return await handler(path,options);
}

async function defaultInboxHandler(path,options) {
    logger.info(`[${path}]`);

    const handler = require_notification_hander(options['notification_handler']);

    fs.readdir(path, (err,files) => {
        files.forEach( (file) => {
            const fullPath = `${path}/${file}`;
            if (file.match("^\\..*$")) {
                // Ignore
            }
            else if (file.match("^.*\\.jsonld$")) {
                // Process
                handler(fullPath,options);

                logger.debug(`removing ${fullPath}`);
                fs.unlinkSync(fullPath);
            }
            else {
                fs.unlinkSync(fullPath);
            }
        });
    });
}

async function defaultNotificationHandler(path,options) {
    logger.info(`Processing ${path} ...`);
    logger.warn(`Default do nothing, no handle_notification set`);
}

function require_inbox_hander(handler) {
    if (handler) {
        if (typeof handler === 'function') {
            return handler;
        }
        else {
            delete require.cache[handler];
            const func = require(handler).handleInbox;
            return func;
        }
    }
    else {
        return defaultInboxHandler;
    }
}

function require_notification_hander(handler) {
    if (handler) {
        if (typeof handler === 'function') {
            return handler;
        }
        else {
            delete require.cache[handler];
            const func = require(handler).handleNotification;
            return func;
        }
    }
    else {
        return defaultNotificationHandler;
    }
}

module.exports = { 
    handle_inbox
};