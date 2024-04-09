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
        body: JSON.stringify(json)
    });

    if (! response.ok) {
        throw Error(`failed to POST to ${url}`);
    }

    return true;
}

function moveToError(path) {
    const errorPath = process.env.LDN_SERVER_ERROR_PATH ?? './error';
    
    if (! fs.existsSync(errorPath)) {
        logger.info(`creating ${errorPath}`);
        fs.mkdirSync(errorPath, { recursive: true });
    }

    const newPath = errorPath + '/' + fsPath.basename(path);

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

module.exports = { 
    getLogger , 
    backOff_fetch , 
    fetchOriginal ,
    moveToError ,
    sendNotification ,
    dynamic_handler
};