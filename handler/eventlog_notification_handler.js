const fs = require('fs');
const fsPath = require('path');
const lockfile = require('proper-lockfile');
const logger = require('../lib/util.js').getLogger();

const EVENT_DIR = 'events';
const EVENT_LOG = 'events.jsonld';

async function handle({path,options}) {
    logger.info(`parsing notification ${path}`);
    
    try {
        const json = JSON.parse(fs.readFileSync(path, { encoding: 'utf-8'}));
      
        const fileName = path.split('/').pop();
        const logDir = fsPath.join(options['public'],EVENT_DIR,'log');

        if (! fs.existsSync(logDir)) {
            logger.info(`creating ${logDir}`);
            fs.mkdirSync(logDir, { recursive : true });
        }
  
        const outboxFile = fsPath.join(logDir,fileName);

        fs.writeFileSync(outboxFile, JSON.stringify(json));

        // Updating metadata file
        const metaFile = outboxFile + '.meta';

        fs.writeFileSync(metaFile, JSON.stringify({
            'Content-Type': 'application/ld+json',
            'Last-Modified': nowISO()
        },null,4));

        await updateEventLog({path,options});

        return { path,options, success: true };
    }
    catch(e) {
        logger.error(`failed to process ${path}`);
        logger.error(e);
        return { path,options, success: false };
    }
}

async function updateEventLog({path,options}) {
    logger.info(`updating eventlog for ${path}`);

    try {
        const fileName = path.split('/').pop();
        const entry = `log/${fileName}`;

        const eventLog = fsPath.join(options['public'],EVENT_DIR,EVENT_LOG);

        let json;
        
        if (fs.existsSync(eventLog)) {
            json = JSON.parse(fs.readFileSync(eventLog, { encoding: 'utf-8'}));
        }
        else {
            json = {
                "@context": "https://labs.eventnotifications.net/contexts/eventlog.jsonld",
                "type": "EventLog",
                "member": []
            };
        }
     
        if (json['member'].findIndex( (e) => e === entry) >= 0) {
            logger.info(`${entry} already in ${eventLog}`);
        }
        else {
            logger.info(`updating ${eventLog}`);

            json['member'].push(entry);

            if (fs.existsSync(eventLog)) {
                try {
                    const lock = await lockfile(eventLog, { retries: 10 });
                    fs.writeFileSync(eventLog,JSON.stringify(json,null,4));
                    lock(); // release
                }
                catch (e) {
                    logger.error(`failed to update ${eventLog}`);
                }
            }
            else {
                fs.writeFileSync(eventLog,JSON.stringify(json,null,4));
            }
        }

        return true;
    }
    catch (e) {
        return false;
    }
}

function nowISO() {
    return (new Date()).toUTCString();
}

module.exports = { handle };