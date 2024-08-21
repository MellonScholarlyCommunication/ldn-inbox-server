const { ldPropertyAsId , parseEventLog } = require('../../lib/util.js');
const logger = require('../../lib/util.js').getLogger();

/**
 * Demonstration notification handler, that checks if the notification
 * message contains an artifact that is known to the data node
 */
async function handle({path,options,config,notification}) {
    try {
        let eventlog = undefined;

        if (ldPropertyAsId(notification['context'])) {
            eventlog = ldPropertyAsId(notification['context']);
        }
        else {
            logger.error(`failed to find valid context or object`);
            return { path, options, success: false };
        }

        if (! eventlog) {
            logger.error(`failed to find eventlog`);
            return { path, options, success: false };
        }

        const eventLogPath = parseEventLog(eventlog,options);

        if (eventLogPath) {
            // Storing the eventlog path to the options. 
            // Maybe bad practice..but it is a workflow attribute like in Nifi :P
            options['eventlog'] = {
                'id': eventlog ,
                'path': eventLogPath
            };
            return { path, options, success: true };
        }
        else {
            logger.error(`artifact ${artifact} is not known here...`);
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