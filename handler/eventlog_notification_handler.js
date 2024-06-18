const fs = require('fs');
const md5 = require('md5');
const fsPath = require('path');
const lockfile = require('proper-lockfile');
const { parseAsJSON } = require('../lib/util');
const logger = require('../lib/util.js').getLogger();

/**
 * Demonstration event log handler
 */
async function handle({path,options}) {
    logger.info(`parsing notification ${path}`);

    const config = parseAsJSON(options['config']);

    if (! config) {
        logger.error('no configuration found for eventlog_notification_handler');
        return { path, options, success: false };
    }

    const thisConfig = config['notification_handler']?.['eventlog'];

    if (! thisConfig || !thisConfig['log'] || !thisConfig['dir']) {
        logger.error('no log/dir entry for notification_handler.eventlog configuration'); 
        return { path, options, success: false };
    }

    const base = options['base'] ? options['base'] : 
                    options['host'] && options['port'] ? 
                        `http://${options['host']}:${options['port']}` :
                            'http://localhost:8000';

    let eventLog = thisConfig['log'];
    let eventDir = thisConfig['dir'];

    let artifactPath = undefined;

    if (options['artifact']) {
        artifactPath = options['artifact']['id'].substring(base.length+1);
        logger.info(artifactPath);
    }

    if (eventLog.match(/@artifact(:[a-zA-Z]+)?@/)) {
        if (options['artifact']) {
            if (eventLog.match(/@artifact:strip@/)) {
                eventLog = eventLog.replaceAll(/@artifact(:[a-zA-Z]+)?@/g,artifactPath.replaceAll(/\.\w+$/g,''));
            }
            else {
                eventLog = eventLog.replaceAll(/@artifact(:[a-zA-Z]+)?@/g,artifactPath);
            }
        }
        else {
            logger.error(`requested to parse ${eventLog} but no artifact information available`);
            return { path, options, success: false };
        }
    } 

    if (eventDir.match(/@artifact(:[a-zA-Z]+)?@/)) {
        if (options['artifact']) {
            if (eventDir.match(/@artifact:strip@/)) {
                eventDir = eventDir.replaceAll(/@artifact(:[a-zA-Z]+)?@/g,artifactPath.replaceAll(/\.\w+$/g,''));
            }
            else {
                eventDir = eventDir.replaceAll(/@artifact(:[a-zA-Z]+)?@/g,artifactPath);
            }
        }
        else {
            logger.error(`requested to parse ${eventDir} but no artifact information available`);
            return { path, options, success: false };
        }
    } 

    try {
        const json = fs.readFileSync(path, { encoding: 'utf-8' });
      
        const fileName = path.split('/').pop();

        if (! fs.existsSync(`${options['public']}/${eventDir}`)) {
            logger.info(`creating ${options['public']}/${eventDir}`);
            fs.mkdirSync(`${options['public']}/${eventDir}`, { recursive : true });
        }

        const eventFile = `${options['public']}/${eventDir}/${fileName}`;

        fs.writeFileSync(eventFile, json);

        // Updating metadata file
        const metaFile = `${options['public']}/${eventLog}.meta`;

        fs.writeFileSync(metaFile, JSON.stringify({
            'Content-Type': 'application/ld+json',
            'Last-Modified': nowISO()
        },null,4));

        // Store the path in the options .. yeah yeah we know ugly but it works for now
     
        const eventPath = `${eventDir}/${fileName}`;
        const eventId = `${base}/${eventPath}`;
        const eventLogId = `${base}/${eventLog}`;

        options['eventlog'] = {
            'id': eventLogId ,
            'file': `${options['public']}/${eventLog}` ,
            'dir': `${options['public']}/${eventDir}` ,
            'item': {
                'id' : eventId ,
                'file' : eventFile 
            }
        };

        await updateEventLog({path,options});

        return { path, options, success: true };
    }
    catch(e) {
        logger.error(`failed to process ${path}`);
        logger.error(e);
        return { path, options, success: false };
    }
}

async function updateEventLog({path,options}) {
    logger.info(`updating eventlog for ${path}`);

    try {
        const notification = fs.readFileSync(path, { encoding: 'utf-8'});
        const notification_checksum = md5(notification);

        const entry = options['eventlog']['item']['id'];
        const eventLog = options['eventlog']['file'];

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

            json['member'].push({
                "id": entry ,
                "checksum": {
                    "type": "Checksum",
                    "algorithm": "spdx:checksumAlgorithm_md5",
                    "checksumValue": notification_checksum
                }
            });

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