const fs = require('fs');
const fsPath = require('path');
const lockfile = require('proper-lockfile');
const { dynamic_handler, moveTo } = require('../lib/util');
const piscina = require('piscina');
const chokidar = require('chokidar');
const logger = require('../lib/util').getLogger();
const { parseAsJSON } = require('../lib/util');

async function handle_inbox(path,options) {
    if (options.single) {
        logger.debug(`*single file execution*`);
        path = options.single;
        return await singleInboxHandler({path,options});
    }
    if (options.loop) {
        logger.debug(`*watcher execution*`);
        return await watcherInboxHandler({path,options});
    }
    else {
        const inbox_handler = options['inbox_handler'];
        if (inbox_handler) {
            logger.debug(`*default execution*`);
        }
        else {
            logger.debug(`*${inbox_handler} execution*`);
        }
        const handler = dynamic_handler(inbox_handler,defaultInboxHandler);
        return await handler({path,options});
    }
}

async function singleInboxHandler({path,options}) {
    const handler = dynamic_handler(
                    options['notification_handler'],
                    fsPath.resolve(__dirname,'..','lib','demoNotificationHandler.js')
                    );
    const config = {};
    const notification = parseAsJSON(path);
    const result = await handler({path,options,config,notification});    
    const success = result['success'];
    const notificationPath = result['path'];

    if (success) {
        logger.info(`processing ${notificationPath} is a success`);
        if (fs.existsSync(notificationPath)) {
            logger.debug(`removing ${notificationPath}`);
            fs.unlinkSync(notificationPath);
        }
    }
    else {
        logger.warn(`processing ${notificationPath} is a failure`);
        logger.debug(`moving ${notificationPath} to ${options['error']}`);
        moveTo(notificationPath,options['error']);
    }
}

async function watcherInboxHandler({path,options}) {
    logger.debug(`[${path}]`);

    // Trick to make sure that handlers will not mess with the options
    // and pass them to each other :P'''
    const options_original = structuredClone(options);

    const watcher = chokidar.watch(path, {
        ignored: /(^|[\/\\])\../, // ignore dotfiles
        persistent: true,
        awaitWriteFinish: true
    });

    watcher.on('ready', () => {
        logger.info(`start watching ${path}...`);
    });

    watcher.on('error', error => {
        logger.error(error);
    });

    watcher.on('add', async path => {
        logger.info(`new notification ${path} detected`);
        options = structuredClone(options_original);
        await singleInboxHandler({path,options});
    });
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

    await poolRun(pool,path,options);
}

async function poolRun(pool,path,options) {
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

                    const config = {};
                    const notification = parseAsJSON(fullPath);

                    promises.push(
                        pool.run({
                            path: fullPath, 
                            options: options,
                            config: config,
                            notification: notification
                            }, 
                            { name: 'handle'}
                        )
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