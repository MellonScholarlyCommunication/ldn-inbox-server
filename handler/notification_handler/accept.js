const fs = require('fs');
const md5 = require('md5');
const logger = require('../../lib/util.js').getLogger();

/**
 * Demonstration notification handler, that creates an 'Accept'
 * notification for each incoming notification message and stores
 * it in the outbox container.
 */
async function handle({path,options,config,notification}) {
    try {
        const id = notification['id'];
        const object = notification['object'];
        const actor_id = notification['actor']['id'];
        const actor_type = notification['actor']['type'];
        const actor_inbox = notification['actor']['inbox'];

        const data = JSON.stringify({
            type: 'Accept',
            actor: {
                id: 'http://my.server' ,
                inbox: 'http://my.inbox' ,
                type: 'Service'
            },
            context: object,
            inReplyTo: id ,
            object: notification,
            target: {
                id: actor_id ,
                type: actor_type ,
                inbox: actor_inbox
            }
        },null,4);

        const outboxFile = options['outbox'] + '/' + md5(data) + '.jsonld';

        logger.info(`storing Accept to ${outboxFile}`);

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