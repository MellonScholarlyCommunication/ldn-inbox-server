const { dynamic_handler , parseConfig , parseAsJSON } = require('../../lib/util.js');
const logger = require('../../lib/util.js').getLogger();
const lockfile = require('proper-lockfile');
const fs = require('fs');
const fsPath = require('path');
const md5 = require('md5');

/**
 * Demonstration notification handler that start multiple notification handlers.
 * Requires a config file that specifies which handlers to start. 
 * The configuration file requires a $.notification_handler.multi.handler entry
 * which is an array of arrays. The outer array defines independent 'workflows' that
 * need to run on an notifiction message. The inner array defines the steps: a
 * sequence of handlers that need to success.
 * 
 * Optionally a configuration for a handler can contain the property `$lock` set
 * to true to force the singular execution of this handler.
 */
async function handle({path,options,_,notification}) {
    let success = false;

    const mainConfig = parseConfig(options['config']);

    if (! mainConfig) {
        logger.error('no configuration found for multi_notification_handler');
        return { path, options, success: false };
    }

    const handlers = mainConfig['notification_handler']?.['multi']?.['handlers'];

    if (! handlers) {
        logger.error('no notification_handler.multi.handlers key in configuration file');
        return { path, options, success: false };
    }

    logger.info(`starting multi handler`);
       
    let workflow_success = 0;
    let workflow_errors = 0;

    // TODO: need a better solution for this 
    // Create original copy of the options, some handler could 
    // mess with these options and we restore the original after every
    // workflow run :P'''
    const options_original = structuredClone(options);

    OUTER: for (let i = 0 ; i < handlers.length ; i++) {
        const workflow = handlers[i];

        let thisWorkflow = true;

        options = structuredClone(options_original);

        try {
            INNER: for (let j = 0 ; j < workflow.length ; j++) {
                let step = undefined;
                let config = undefined;

                if (typeof workflow[j] === 'string' || workflow[j] instanceof String) {
                    step = workflow[j];
                    config = {};
                }
                else {
                    step = workflow[j]['id'];
                    delete workflow[j]['id']; 
                    config = workflow[j];
                }

                logger.info(`workflow[${i}] : starting ${step}`);

                const handler = dynamic_handler(step,null);

                if (! handler) {
                    throw new Error(`failed to load ${step}`);
                }

                const result = await maybeLock(step,config, async() => {
                    return await handler({path,options,config,notification});
                });
            
                if (! result) {
                    logger.error(`workflow[${i}] : failed ${step} (no results)`);
                    thisWorkflow = result['failure'];
                }
                else if (result['break']) {
                    logger.info(`workflow[${i}] : breaks ${step} with ${result['success']}`);
                    thisWorkflow = result['success'];
                }
                else if (result['success']) {
                    logger.info(`workflow[${i}] : finished ${step}`);
                }
                else {
                    logger.error(`workflow[${i}] : failed ${step}`);
                    thisWorkflow = false;

                    if (options['fallback']) {
                        const fallback_id = options['fallback']['id'];
                        config = options['fallback'];

                        logger.debug(`loading fallback ${fallback_id}`);
                        const fallback = dynamic_handler(fallback_id,null);

                        if (!fallback) {
                            throw new Error(`failed to load ${fallback_id}`);
                        }

                        logger.info(`workflow[${i}] : starting ${fallback_id}`);
                        const fallback_result = await fallback({path,options,config,notification});

                        if (fallback_result['success']) {
                            logger.info(`workflow[${i}] : finished ${fallback_id}`);
                        }
                        else {
                            logger.error(`workflow[${i}] : failed ${fallback_id}`);
                        }
                    }
                    else {
                        logger.debug(`no fallBack defined`);                       
                    }

                    break INNER;
                }
            }
        }
        catch (e) {
            logger.error(`failed to process ${path}`);
            logger.error(e);
            thisWorkflow = false;
        }

        if (thisWorkflow) {
            workflow_success++;
        }
        else {
            workflow_errors++;
        }

        // Each workflow needs to install its own fallBack
        delete options['fallback'];
    }

    if (handlers.length > 0 && workflow_success > 0) {
        success = true;
    }
    else {
        success = false;
    }

    logger.info(`finished multi handler`);

    return { path, options, success: success };
}

async function maybeLock(step,config,callback) {
    if (config['$lock']) {
        const lockDir = process.env.LDN_SERVER_LOCK_DIR || '.lockdir';
        const lockStale = process.env.LDN_SERVER_LOCK_STALE || 10000;
        const lockRetries = process.env.LDN_SERVER_LOCK_RETRIES || 10;

        if (! fs.existsSync(lockDir)) {
            logger.debug(`creating lock dir ${lockDir}`);
            fs.mkdirSync(lockDir);
        }

        const lockFile = fsPath.join(lockDir,md5(step));

        if (! fs.existsSync(lockFile)) {
            logger.debug(`creating lock file ${lockFile}`);
            fs.writeFileSync(lockFile,'');
        }
        
        let result = null;

        try {
            logger.debug(`locking ${step} using ${lockFile}`);

            const unlock = await lockfile.lock(lockFile, { stale : lockStale , retries: lockRetries });

            result = await callback();

            logger.debug(`unlocking ${step} from ${lockFile}`);

            unlock();
        }
        catch (e) {
            logger.error(`lock failed: ${e.message}`);
        }

        return result;
    }
    else {
        logger.trace(`asynchronous ${step}`);
        return await callback();
    }
}

module.exports = { handle };