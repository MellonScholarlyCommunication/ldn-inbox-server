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
const { handle_inbox } = require('../lib/handler');
const logger = getLogger();

let INBOX_URL = 'inbox/';
let INBOX_PATH = './inbox';
let INBOX_BASE_URL = 'http://localhost:8000';
let INBOX_PUBLIC_READABLE = 0;
let JSON_SCHEMA = '';

function inbox_server(options) {
    INBOX_URL = options['url'];
    INBOX_PATH = options['inbox'];
    INBOX_BASE_URL = options['base'];
    INBOX_PUBLIC_READABLE = options['inboxPublic'];
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
        base: options['base'],
        public: options['public'],
        registry: registry
    });
}

function doInbox(req,res) {
    if (req.method === 'GET' && INBOX_PUBLIC_READABLE == 1) {
        doInboxGET(req,res);
    }
    else if (req.method == 'HEAD' && INBOX_PUBLIC_READABLE == 1) {
        doInboxHEAD(req,res);
    }
    else if (req.method === 'POST') {
        doInboxPOST(req,res);
    }
    else { 
        logger.error(`tried method ${req.method} on inbox : forbidden`);
        res.writeHead(403);
        res.end('Forbidden');
    }
}

function doInboxGET(req,res) {
    const pathItem = req.url.substring(INBOX_URL.length);

    logger.debug(`doInboxGET (for ${pathItem})`);

    if (pathItem === '/')  {
        doInboxGET_Index(req,res);
    }
    else if (pathItem.match(/^\/[A-Za-z0-9_-]+\.jsonld$/)) {
        doInboxGET_Read(req,res);
    }
    else {
        res.writeHead(403);
        res.end('Forbidden');
    }
}

function doInboxHEAD(req,res) {
    const pathItem = req.url.substring(INBOX_URL.length);
    const id = pathItem.substring(1);

    logger.debug(`doInboxHEAD (for ${pathItem})`);

    if (pathItem === '/')  {
        const meta = getBody(`${id}.meta`);
    
        if (meta) {
            const metadata = JSON.parse(meta);
            for (let property in metadata) {
                res.setHeader(property,metadata[property]);
            }
        }
        else {
            res.setHeader('Content-Type','application/ld+json');
        }
        res.writeHead(200);
        res.end();
        return;
    }

    if (pathItem.match(/^\/[A-Za-z0-9_-]+\.jsonld$/)) {
        const result = getBody(id);

        if (! result) {
            res.writeHead(403);
            res.end('Forbidden');
            return;
        }

        const meta = getBody(`${id}.meta`);
        
        if (meta) {
            const metadata = JSON.parse(meta);
            for (let property in metadata) {
                res.setHeader(property,metadata[property]);
            }
        }
        else {
            res.setHeader('Content-Type','application/ld+json');
        }

        res.writeHead(200);
        res.end(); 
        return;
    }
    else {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }
}

function doInboxGET_Index(req,res) {
    const notifications = listInbox().map( (e) => {
        return INBOX_BASE_URL + '/' + INBOX_URL + e;
    });

    const result = {
        "@context": "http://www.w3.org/ns/ldp",
        "@id": INBOX_BASE_URL + '/' + INBOX_URL,
        "contains": notifications
    };

    const meta = getBody(`.meta`);
        
    if (meta) {
        const metadata = JSON.parse(meta);
        for (let property in metadata) {
            res.setHeader(property,metadata[property]);
        }
    }
    else {
        res.setHeader('Content-Type','application/ld+json');
    }

    res.writeHead(200);
    res.end(JSON.stringify(result,null,2));
}

function doInboxGET_Read(req,res) {
    const pathItem = req.url.substring(INBOX_URL.length);
    const id = pathItem.substring(1);
    const result = getBody(id);

    if (result) {
        const meta = getBody(`${id}.meta`);
        
        if (meta) {
            const metadata = JSON.parse(meta);
            for (let property in metadata) {
                res.setHeader(property,metadata[property]);
            }
        }
        else {
            res.setHeader('Content-Type','application/ld+json');
        }

        res.writeHead(200);
        res.end(result);
    }
    else {
        res.writeHead(403);
        res.end('Forbidden'); 
    }
}

function doInboxPOST(req,res) {
    const pathItem = req.url.substring(INBOX_URL.length);

    if (pathItem !== '/') {
        req.writeHead(403);
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

function listInbox() {
    const glob = new RegExp("^.*\\.jsonld$");

    logger.debug(`listInbox()`);

    try {
        const entries = fs.readdirSync(INBOX_PATH).filter( (file) => {
            return file.match(glob);
        });
        return entries;
    }
    catch(e) {
        logger.error(e);
        return [];
    }
}

function getBody(id) {
    logger.debug(`getBody(${id})`);

    try {
        return fs.readFileSync(INBOX_PATH + '/' + id, {encoding : 'utf-8'});
    }
    catch(e) {
        return null;
    }
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
    handle_inbox 
};