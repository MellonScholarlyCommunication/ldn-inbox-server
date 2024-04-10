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

    const glob       = new RegExp(options['glob'] ?? "^.*\\.jsonld$");
    const batch_size = options['batch_size'] ?? 5;
    const handler    = dynamic_handler(options['notification_handler'],null);

    // Need some more elegant code here to select of batch of files to
    // process in the path. The code below will work as long as the 
    // number of files in the inbox don't become gigantic...
    const files = fs.readdirSync(path);

    const promisses = [];

    for (let i = 0 ; i < files.length ; i++) {
        const file = files[i];
        const fullPath = `${path}/${file}`;

        if (promisses.length > batch_size) break;

        if (file.match(glob)) {
            const proc = await fileProcessor(fullPath,handler,options); 
            if (proc) {
                promisses.push(proc()); 
            }
        }
    }

    return new Promise( (resolve) => {
        Promise.all(promisses).then( async (value) => {
            resolve(true);
        });
    });
}

async function fileProcessor(path,handler,options) {
    return new Promise( (resolve) => {
        lockfile.lock(path)
            .then( async (release) => {
                resolve( async() => {
                    try {
                        await handler(path,options);
                    }
                    catch (e) {
                        logger.error(e);
                        logger.error(`handler failed on ${path}`);
                    }
                    if (fs.existsSync(path)) {
                        logger.debug(`removing ${path}`);
                        fs.unlinkSync(path);
                    }
                    return release();
                });
            })
            .catch( (e) => {
                logger.debug(`${path} is locked`);
                resolve(null);
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