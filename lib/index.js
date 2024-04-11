const { start_server } = require('mellon-server');
const Validator = require('jsonschema').Validator;
const fs = require('fs');
const md5 = require('md5');
const { 
    getLogger, 
    fetchOriginal, 
    backOff_fetch, 
    sendNotification,
    moveTo
} = require('../lib/util');
const { handle_inbox , defaultSendNotificationHandler } = require('../lib/handler');
const logger = getLogger();

let INBOX_URL = 'inbox/';
let INBOX_PATH = './inbox';
let JSON_SCHEMA = '';

function inbox_server(options) {
    INBOX_URL = options['url'];
    INBOX_PATH = options['inbox'];
    JSON_SCHEMA = JSON.parse(fs.readFileSync(options['schema'], { encoding: 'utf-8'}));
    let registry = [{ path : `${INBOX_URL}.*` , do: doInbox }];

    // Add other (external defined) registry parts
    if (options['registry']) {
        const path = options['registry'];
        let registry2;
        if (typeof path === 'string' || path instanceof String) {
            registry2 = JSON.parse(fs.readFileSync(path,{ encoding: 'utf-8'}));
        }
        else {
            registry2 = path;
        }
        registry = registry.concat(registry2);
    }

    start_server({
        host: options['host'],
        port: options['port'],
        public: options['public'],
        registry: registry
    });
}

function doInbox(req,res) {
    if (req.method !== 'POST') {
        logger.error(`tried method ${req.method} on inbox : forbidden`);
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    const headers = req.headers;

    if (headers && headers['content-type'] && (
        headers['content-type'].startsWith('application/ld+json') ||
        headers['content-type'].startsWith('application/json')
        )
    ) {
        // We are ok
    }
    else {
        logger.error(`tried content-type ${headers['content-type']} : unknown`);
        res.writeHead(400);
        res.end(`Need a Content-Type 'application/ld+json'`);
        return;
    }

    let postData = ''
    req.on('data', (data) => {
        postData += data;
    });
    req.on('end',() => {
        logger.debug(postData);
        if (checkBody(postData)) {
            const id = storeBody(postData);
            logger.debug(`accepted ${req.url}${id}`);
            res.setHeader('Location',`${req.url}${id}`);
            res.writeHead(201);
            res.end(`Accepted ${req.url}${id}`);
        }
        else {
            logger.error(`not-accepted post`);
            res.writeHead(400);
            res.end(`Looks like a weird POST to me...`);
        }
    });
}

function storeBody(data) {
    try {
        const id = md5(data);
        const newpath = `${INBOX_PATH}/${id}.jsonld`;

        if (! fs.existsSync(newpath)) {
            logger.debug(`storing ${newpath}`);
            fs.writeFileSync(newpath,data);
        }
        else {
            logger.debug(`skipping ${newpath} : already exists`);
        }

        return `${id}.jsonld`;
    }
    catch (e) {
        return null;
    }
}

function checkBody(data) {
    if (! JSON_SCHEMA && ! fs.existsSync(JSON_SCHEMA)) {
        logger.debug(`no JSON_SCHEMA found`);
        return true;
    }
    try {
        const json = JSON.parse(data);
        const v = new Validator();
        const res = v.validate(json,JSON_SCHEMA);

        if (res.errors.length == 0) {
            return true;
        }
        else {
            return false;
        }
    }
    catch (e) {
        logger.error(`failed to validate data`);
        logger.debug(e);
        return false;
    }
}

module.exports = { 
    inbox_server , 
    getLogger , 
    backOff_fetch , 
    fetchOriginal ,
    moveTo ,
    sendNotification ,
    defaultSendNotificationHandler ,
    handle_inbox 
};