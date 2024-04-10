const fs = require('fs');
const logger = require('../lib/util.js').getLogger();
const { moveTo } = require('../lib/util');

async function handle(path,options) {
    logger.info(`parsing notification ${path}`);
    try {
        const json = JSON.parse(fs.readFileSync(path, { encoding: 'utf-8'}));
        
        const outboxFile = options['outbox'] + '/' + path.split('/').pop();

        const id = json['id'];
        const object = json['object'];
        const actor_id = json['actor']['id'];
        const actor_type = json['actor']['type'];
        const actor_inbox = json['actor']['inbox'];

        logger.info(`storing Accept to ${outboxFile}`);

        fs.writeFileSync(outboxFile, JSON.stringify({
            type: 'Accept',
            actor: {
                id: 'http://my.server' ,
                inbox: 'http://my.inbox' ,
                type: 'Service'
            },
            context: object,
            inReplyTo: id ,
            object: json,
            target: {
                id: actor_id ,
                type: actor_type ,
                inbox: actor_inbox
            }
        },null,2));
    }
    catch(e) {
        logger.error(`failed to process ${path}`);
        logger.debug(e);
        moveTo(path,'@error');
    }
}

module.exports = { handle };