const logger = require('../../lib/util.js').getLogger();

/**
 * Handler that does nothing (debug purposes)
 */
async function handle({path,options,config}) {
    try {
        return { path, options, success: true };
    }
    catch(e) {
        logger.error(`failed to process ${path}`);
        logger.error(e);
        return { path, options, success: false };
    }
}

module.exports = { handle };