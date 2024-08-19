const fs = require('fs');
const fsPath = require('path');
const lockfile = require('proper-lockfile');
const { dynamic_handler, moveTo } = require('../lib/util');
const piscina = require('piscina');
const logger = require('../lib/util.js').getLogger();

async function handle_inbox(path,options) {
    const handler = dynamic_handler(options['inbox_handler'],defaultInboxHandler);
    return await handler({path,options});
}

async function defaultInboxHandler({path,options}) {
    logger.debug(`[${path}]`);

    const queue_size = options['queue_size'] ?? 'auto';

    let worker;

    if (options['notification_handler']) {
        worker = options['notification_handler']
                    .replaceAll(/@handler/g,fsPath.resolve(__dirname,'..','handler'));
    }
    else {
        worker = fsPath.resolve(__dirname,'..','lib','demoNotificationHandler.js');
    }

    // Run the notifications using a node.js worker pool
    const pool = new piscina({
        filename: worker,
        maxQueue: queue_size
    });

    const loopWait = options['loop'] || 0;

    do {
        try {
            const [prms,locks] = await inboxProcessor(pool,path,options);
            const results = await Promise.all(prms);

            for (let i = 0 ; i < results.length ; i++) {
                const result = results[i];
                const success = result['success'];
                const notification = result['path'];

                if (success) {
                    logger.info(`processing ${notification} is a success`);
                    if (fs.existsSync(notification)) {
                        logger.debug(`removing ${notification}`);
                        fs.unlinkSync(result['path']);
                    }
                }
                else {
                    logger.warn(`processing ${notification} is a failure`);
                    logger.debug(`moving ${notification} to ${options['error']}`);
                    moveTo(notification,options['error']);
                }

                // release lock
                if (locks[i]) locks[i]();
            }
        }
        catch (e) {
            logger.error(e);
        }

        if (loopWait) {
            logger.debug(`sleep ${loopWait} secs...`);
            await new Promise(resolve => setTimeout(resolve, loopWait*1000));
        }
    }
    while (loopWait > 0);
}

async function inboxProcessor(pool,path,options) {
    const glob       = new RegExp(options['glob'] ?? "^.*\\.jsonld$");
    const batch_size = options['batch_size'] ?? 5;

    return new Promise( (resolve) => {
        fs.readdir( path, async (err,files) => {
            if (err) {
                resolve([]);
            }

            let counter = 0;
            const promises = [];
            const locks = [];

            for (let i = 0 ; i < files.length ; i++) {
                const file = files[i];
                const fullPath = fsPath.join(path,file);

                if (!file.match(glob))
                    continue;

                try {
                    const lock = await lockfile(fullPath);

                    logger.info(`adding ${fullPath} to queue`);

                    promises.push(
                        pool.run({path: fullPath, options: options}, { name: 'handle'})
                    );

                    locks.push(lock);

                    counter++;

                    if (counter == batch_size) { break } 
                }
                catch(e) {
                    logger.debug(`${fullPath} is locked`);
                    locks.push(null);
                }
            }

            return resolve([promises,locks]);
        });
    });
}

module.exports = { 
    handle_inbox,
    defaultInboxHandler 
};