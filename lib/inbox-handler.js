const fs = require('fs');
const lockfile = require('proper-lockfile');
const { dynamic_handler } = require('../lib/util');
const logger = require('../lib/util.js').getLogger();

async function handle_inbox(path,options) {
    const handler = dynamic_handler(options['inbox_handler'],defaultInboxHandler);
    return await handler(path,options);
}

async function defaultInboxHandler(path,options) {
    logger.info(`[${path}]`);

    const handler = dynamic_handler(options['notification_handler'],defaultNotificationHandler);

    fs.readdir(path, (err,files) => {
        files.forEach( (file) => {
            const fullPath = `${path}/${file}`;
            if (file.match("^\\..*$")) {
                // Ignore
            }
            else if (file.match("^.*\\.jsonld$")) {
                // Process
                lockfile.lock(fullPath)
                    .then( (release) => {
                        handler(fullPath,options);
                        logger.debug(`removing ${fullPath}`);
                        fs.unlinkSync(fullPath);
                        return release();
                    })
                    .catch( (e) => {
                        logger.warn(`${fullPath} is locked`);
                    });
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

module.exports = { 
    handle_inbox,
    defaultInboxHandler,
    defaultNotificationHandler
};