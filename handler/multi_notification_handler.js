const { dynamic_handler , parseAsJSON } = require('../lib/util');
const logger = require('../lib/util.js').getLogger();

/**
 * Demonstration notification handler that start multiple notification handlers.
 * Requires a config file that specifies which handlers to start. 
 */
async function handle({path,options}) {
    let success = false;

    const config = parseAsJSON(options['config']);

    if (! config) {
        logger.error('no configuration found for multi_notification_handler');
        return { path, options, success: false };
    }

    const handlers = config['notification_handler']?.['multi']?.['handlers'];

    if (! handlers) {
        logger.error('no notification_handler.multi.handlers key in configuration file');
        return { path, options, success: false };
    }

    try {
        logger.info(`starting multi handler`);
        
        for (let i = 0 ; i < handlers.length ; i++) {
            logger.info(`starting ${handlers[i]}`);

            const handler = dynamic_handler(handlers[i],null);

            if (! handler) {
                throw new Error(`failed to load ${handlers[i]}`);
            }

            const result = await handler({path,options});
           
            if (result['success']) {
                logger.info(`finished ${handlers[i]}`);
            }
            else {
                throw new Error(`Eek! ${handlers[i]} failed`);
            }
        }

        success = true;
    }
    catch (e) {
        logger.error(`failed to process ${path}`);
        logger.error(e);

        success = false;
    }

    logger.info(`finished multi handler`);

    return { path, options, success: success };
}   

module.exports = { handle };