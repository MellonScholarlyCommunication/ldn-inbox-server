const logger = require('../../lib/util.js').getLogger();

/**
 * Demonstration notification handler, that checks if the notification
 * matches a configurable list
 */
async function handle({path,options,config,notification}) {
    if (! config) {
        logger.error('no configuration found for eventlog_notification_handler');
        return { path, options, success: false };
    }

    if (! (config['anyOf'] && Array.isArray(config['anyOf']))) {
        logger.error('no anyOf entry in notification_handler.type_filer should be an array'); 
        return { path, options, success: false };
    }

    try {
        const type = notification['type'];

        const typeArray = Array.isArray(type) ? type : [type];

        let isOk = true ;

        for (let i = 0 ; i < typeArray.length ; i++) {
            if (config['anyOf'].includes(typeArray[i])) {
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
        logger.error(e);
        return { path, options, success: false };
    }
}

module.exports = { handle };