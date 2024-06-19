const fs = require('fs');
const { parseAsJSON } = require('../lib/util');
const logger = require('../lib/util.js').getLogger();

/**
 * Demonstration notification handler, that checks if the notification
 * matches a configurable list
 */
async function handle({path,options}) {
    logger.info(`parsing notification ${path}`);
    
    const config = parseAsJSON(options['config']);

    if (! config) {
        logger.error('no configuration found for eventlog_notification_handler');
        return { path, options, success: false };
    }

    const thisConfig = config['notification_handler']?.['type_filter'];

    if (! thisConfig) {
        logger.error('no notification_handler.type_filer configuration'); 
        return { path, options, success: false };
    }

    if (! (thisConfig['anyOf'] && Array.isArray(thisConfig['anyOf']))) {
        logger.error('no anyOf entry in notification_handler.type_filer should be an array'); 
        return { path, options, success: false };
    }

    try {
        const json = parseAsJSON(path);
        
        const type = json['type'];

        const typeArray = Array.isArray(type) ? type : [type];

        let isOk = true ;

        for (let i = 0 ; i < typeArray.length ; i++) {
            if (thisConfig['anyOf'].includes(typeArray[i])) {
                // We are ok
            }
            else {
                logger.error(`${typeArray[i]} does not pass type_filter check`);
                isOk = false;
                break;
            }       
        }

        if (isOk) {
            return { path, options, success: true };
        }
        else {
            return { path, options, success: false };
        }
    }
    catch(e) {
        logger.error(`failed to process ${path}`);
        logger.debug(e);
        return { path, options, success: false };
    }
}

module.exports = { handle };