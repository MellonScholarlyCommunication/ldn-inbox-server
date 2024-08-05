const fs = require('fs');
const md5 = require('md5');
const logger = require('../../lib/util.js').getLogger();

/**
 * Demonstration notification handler, that creates an 'Offer'
 * notification for each incoming notificaation to request the
 * archivation of the event log.
 */
async function handle({path,options,config}) {
    logger.info(`parsing notification ${path}`);

    if (! config) {
        logger.error('no configuration found for offer_memento_notification_handler');
        return { path, options, success: false };
    }
   
    if (!config['actor'] || !config['target']) {
        logger.error('no actor/target entry for notification_handler.eventlog configuration'); 
        return { path, options, success: false };
    }

    if (!options['artifact']) {
        logger.info(`no artifact found (ignoring this request)`);
        return { path, options, success: true };
    }

    if (!options['eventlog']) {
        logger.info(`no artifact found (ignoring this request)`);
        return { path, options, success: true };
    }

    try {
        const data = JSON.stringify({
            '@context': [ 
                "https://www.w3.org/ns/activitystreams" ,
                {"schema": "https://schema.org/"}
            ], 
            type: 'Offer',
            actor: config['actor'],
            object: {
                id: options['eventlog']['id'],
                type: [ "Document", "schema:Dataset" ]
            },
            target: config['target']
        },null,4);

        const outboxFile = options['outbox'] + '/' + md5(data) + '.jsonld';

        logger.info(`storing Offer to ${outboxFile}`);

        fs.writeFileSync(outboxFile,data);

        return { path, options, success: true };
    }
    catch(e) {
        logger.error(`failed to process ${path}`);
        logger.error(e);
        return { path, options, success: false };
    }
}

module.exports = { handle };