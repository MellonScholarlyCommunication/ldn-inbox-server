const { dynamic_handler , parseConfig , parseAsJSON } = require('../../lib/util.js');
const logger = require('../../lib/util.js').getLogger();

/**
 * Demonstration notification handler that start multiple notification handlers.
 * Requires a config file that specifies which handlers to start. 
 * The configuration file requires a $.notification_handler.multi.handler entry
 * which is an array of arrays. The outer array defines independent 'workflows' that
 * need to run on an notifiction message. The inner array defines the steps: a
 * sequence of handlers that need to success.
 */
async function handle({path,options}) {
    let success = false;

    const config = parseConfig(options['config']);

    if (! config) {
        logger.error('no configuration found for multi_notification_handler');
        return { path, options, success: false };
    }

    const notification = parseAsJSON(path);

    const handlers = config['notification_handler']?.['multi']?.['handlers'];

    if (! handlers) {
        logger.error('no notification_handler.multi.handlers key in configuration file');
        return { path, options, success: false };
    }

    logger.info(`starting multi handler`);
       
    let workflow_success = 0;
    let workflow_errors = 0;

    OUTER: for (let i = 0 ; i < handlers.length ; i++) {
        const workflow = handlers[i];

        let thisWorkflow = true;

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

                const result = await handler({path,options,config,notification});
            
                if (result['break']) {
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

module.exports = { handle };