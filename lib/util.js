const fs = require('fs');
const fsPath = require('path');
const log4js = require('log4js');
const path = require('path');
const { backOff } = require('exponential-backoff');
const { v4: uuidv4 } = require('uuid');
const fetch = require('node-fetch');
require('dotenv').config();

const logger = getLogger();

function getLogger() {
    const logger = log4js.getLogger();

    if (process.env.LOG4JS) {
        log4js.configure({
            appenders: {
            stderr: { type: 'stderr' }
            },
            categories: {
            default: { appenders: ['stderr'], level: process.env.LOG4JS }
            }
        });
    }

    return logger;
}

async function fetchOriginal(url) {
    logger.info(`Fetching ${url}...`);
    
    const response = await backOff_fetch(url, { method: 'GET' });

    if (!response.ok) {
        logger.error(`Failed to fetch original ${url} [${response.status}]`);
        throw Error(`failed to fetch object ${url}`);
    }

    const body = await response.text();

    return body;
}

async function backOff_fetch(url,options) {
    return await backOff( () => fetch(url,options) , {
        retry: (e,attempt) => {
            logger.warn(`attempt ${attempt} on ${url}`);
            return true;
        }
    });
}

async function sendNotification(url,json,options) {
    if (!json['@context']) {
        json['@context'] = "https://www.w3.org/ns/activitystreams";
    }

    if (!json['id']) {
        json['id'] = 'urn:uuid:' + uuidv4();
    }

    let fetcher = (options && options['fetch']) ? options['fetch'] : backOff_fetch;

    const response = await fetcher(url, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(json,null,4)
    });

    if (! response.ok) {
        throw Error(`failed to POST to ${url}`);
    }

    return true;
}

function moveTo(path,destination) {
    let destPath = destination;

    switch (destination) {
        case '@inbox':
            destPath = process.env.LDN_SERVER_INBOX_PATH ?? './inbox';
            break;
        case '@error':
            destPath = process.env.LDN_SERVER_ERROR_PATH ?? './error';
            break;
        case '@outbox':
            destPath = process.env.LDN_SERVER_ERROR_PATH ?? './error';
            break;
    }
    
    if (! fs.existsSync(destPath)) {
        logger.info(`creating ${destPath}`);
        fs.mkdirSync(destPath, { recursive: true });
    }

    const newPath = destPath + '/' + fsPath.basename(path);

    fs.rename(fsPath.resolve(path), fsPath.resolve(newPath), function (err) {
        if (err) throw err
        logger.info(`moving ${path} to${newPath}`);
    });
}

function dynamic_handler(handler,fallback) {
    if (handler) {
        if (typeof handler === 'function') {
            logger.debug(`handler is explicit`);
            return handler;
        }
        else {
            const abs_handler = path.resolve(handler);
            logger.debug(`trying dynamic load of ${handler} -> ${abs_handler}`);
            delete require.cache[abs_handler];
            const func = require(abs_handler).handle;
            return func;
        }
    }
    else {
        logger.debug(`using fallback handler`);
        return fallback;
    }
}

function parseAsJSON(path) {
    try {
        return JSON.parse(fs.readFileSync(path, { encoding: 'utf-8'}));
    }
    catch (e) {
        logger.error(`failed to parse ${path}`);
        return null;
    }
}

function ldPropertyAsId(object_or_string) {
    if (!object_or_string) {
        return null;
    }

    if (typeof object_or_string === 'string' || object_or_string instanceof String) {
        return object_or_string;
    }
    else if (typeof object_or_string === 'object' && object_or_string['id']) {
        return object_or_string['id'];
    }
    else if (typeof object_or_string === 'object' && object_or_string['@id']) {
        return object_or_string['@id'];
    }
    else {
        return null;
    }
}

function parseArtifact(url,options) {
    logger.debug(`isArtifact(${url})?`);

    const resource = parseLocalResource(url,options);

    if (resource === null)  {
        return null;
    }

    const { filePath , metaPath , json} = resource;

    if (json['X-Artifact']) {
        return filePath;
    }
    else {
        return null;
    }
}

function parseEventLog(url,options) {
    logger.debug(`isEventLog(${url})?`);

    const resource = parseLocalResource(url,options);

    if (resource === null)  {
        return null;
    }

    const { filePath , metaPath , json} = resource;

    return filePath;
}

function parseLocalResource(url,options) {
    logger.debug(`isLocalResource(${url})?`);

    const base = options['base'] ? options['base'] : 
                    options['host'] && options['port'] ? 
                        `http://${options['host']}:${options['port']}` :
                            'http://localhost:8000';

    const public = options['public'];

    const filePath = `${public}/` + url.substring(base.length + 1);

    const metaPath = `${filePath}.meta`;

    logger.debug(`searching ${metaPath}`);
    
    if (! fs.existsSync(metaPath)) {
        logger.debug(`no such file ${metaPath}`);
        return null;
    }

    const json = parseAsJSON(metaPath);

    if (json === null)  {
        logger.debug(`no json at ${metaPath}`);
        return null;
    }

    return { filePath, metaPath, json };
}

module.exports = { 
    getLogger , 
    backOff_fetch , 
    fetchOriginal ,
    moveTo ,
    sendNotification ,
    dynamic_handler ,
    parseAsJSON ,
    parseArtifact ,
    parseEventLog ,
    parseLocalResource ,
    ldPropertyAsId
};