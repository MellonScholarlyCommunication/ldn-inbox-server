const logger = require('../../lib/util.js').getLogger();

/**
 * Handler that sets the 'fallback' handler option
 */
async function handle({path,options,config}) {
    try {
        const fallback = config['handler'];

        if (!fallback) {
            logger.error('no handler configuration found');
            return { path, options, success: true };
        }

        logger.info(`setting fallback to ${fallback}`);

        options['fallback'] = fallback;

        return { path, options, success: true };
    }
    catch(e) {
        logger.error(`failed to process ${path}`);
        logger.error(e);
        return { path, options, success: false };
    }
}

module.exports = { handle };