const { dynamic_handler , parseConfig } = require('../../lib/util.js');
const logger = require('../../lib/util.js').getLogger();

/**
 * Demonstration notification handler that start multiple notification handlers.
 * Requires a config file that specifies which handlers to start. 
 */
async function handle({path,options}) {
    let success = false;

    const config = parseConfig(options['config']);

    if (! config) {
        logger.error('no configuration found for multi_notification_handler');
        return { path, options, success: false };
    }

    const handlers = config['notification_handler']?.['multi']?.['handlers'];

    if (! handlers) {
        logger.error('no notification_handler.multi.handlers key in configuration file');
        return { path, options, success: false };
    }

    logger.info(`starting multi handler`);
       
    let workflow_success = 0;
    let workflow_errors = 0;

    for (let i = 0 ; i < handlers.length ; i++) {
        const workflow = handlers[i];

        let thisWorkflow = true;

        try {
            for (let j = 0 ; j < workflow.length ; j++) {
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

                const result = await handler({path,options,config});
            
                if (result['success']) {
                    logger.info(`workflow[${i}] : finished ${step}`);
                }
                else {
                    logger.error(`workflow[${i}] : failed ${step}`);
                    thisWorkflow = false;
                    break;
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