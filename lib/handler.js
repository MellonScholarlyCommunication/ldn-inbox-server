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

    if (! result) {
        logger.warn(`processing ${path} is a failure (no result)`);
        logger.debug(`moving ${path} to ${options['error']}`);
        moveTo(path,options['error'],'handler returned no result');
        return;
    }

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
        moveTo(notificationPath,options['error'],result['reason'] ?? 'handler returned success:false');
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
        try {
            options = structuredClone(options_original);
            await singleInboxHandler({path,options});
        }
        catch (e) {
            logger.error(`failed to process ${path}`);
            logger.error(e);
        }
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
    let jobs = [];

    try {
        jobs = await inboxProcessor(pool,path,options);
        const results = await Promise.allSettled(jobs.map( job => job.promise ));

        for (let i = 0 ; i < results.length ; i++) {
            const outcome = results[i];

            if (outcome.status === 'rejected') {
                logger.error(outcome.reason);
                continue;
            }

            const result = outcome.value;

            if (! result) {
                logger.error(`no result for job ${i}`);
                continue;
            }

            const notification = result['path'];

            if (result['success']) {
                logger.info(`processing ${notification} is a success`);
                if (fs.existsSync(notification)) {
                    logger.debug(`removing ${notification}`);
                    fs.unlinkSync(notification);
                }
            }
            else {
                logger.warn(`processing ${notification} is a failure`);
                logger.debug(`moving ${notification} to ${options['error']}`);
                moveTo(notification,options['error'],result['reason'] ?? 'handler returned success:false');
            }
        }
    }
    catch (e) {
        logger.error(e);
    }
    finally {
        // release all locks, even on error
        for (let i = 0 ; i < jobs.length ; i++) {
            try { jobs[i].lock(); }
            catch (e) { logger.debug(`unlock failed: ${e.message}`); }
        }
    }
}

async function inboxProcessor(pool,path,options) {
    const glob       = new RegExp(options['glob'] ?? "^.*\\.jsonld$");
    const batch_size = options['batch_size'] ?? 5;

    return new Promise( (resolve) => {
        fs.readdir( path, async (err,files) => {
            if (err) {
                logger.error(err);
                return resolve([]);
            }

            let counter = 0;
            const jobs = [];

            for (let i = 0 ; i < files.length ; i++) {
                const file = files[i];
                const fullPath = fsPath.join(path,file);

                if (!file.match(glob))
                    continue;

                let lock;

                try {
                    lock = await lockfile(fullPath);
                }
                catch(e) {
                    logger.debug(`${fullPath} is locked`);
                    continue;
                }

                logger.info(`adding ${fullPath} to queue`);

                const config = {};
                const notification = parseAsJSON(fullPath);

                const promise = pool.run({
                    path: fullPath,
                    options: options,
                    config: config,
                    notification: notification
                    },
                    { name: 'handle'}
                );

                // promise paired with its lock so they can never desync
                jobs.push({ promise, lock });

                counter++;

                if (counter == batch_size) { break }
            }

            return resolve(jobs);
        });
    });
}

module.exports = { 
    handle_inbox,
    defaultInboxHandler 
};