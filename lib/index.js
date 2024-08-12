
const Validator = require('jsonschema').Validator;
const fs = require('fs');
const md5 = require('md5');
const { 
    getLogger, 
    fetchOriginal, 
    backOff_fetch, 
    sendNotification,
    moveTo,
    parseAsJSON,
    generateId
} = require('../lib/util');
const { handle_inbox } = require('../lib/handler');
const logger = getLogger();

function doInbox(req,res,opts) {
    if (req.method === 'GET' && opts['inboxPublic'] == 1) {
        doInboxGET(req,res,opts);
    }
    else if (req.method == 'HEAD' && opts['inboxPublic'] == 1) {
        doInboxHEAD(req,res,opts);
    }
    else if (req.method === 'POST' && opts['inboxWriteable'] == 1) {
        doInboxPOST(req,res,opts);
    }
    else { 
        logger.error(`tried method ${req.method} on inbox : forbidden`);
        res.writeHead(403);
        res.end('Forbidden');
    }
}

function doInboxGET(req,res,opts) {
    const pathItem = req.url.substring(opts['url'].length);

    logger.debug(`doInboxGET (for ${pathItem})`);

    if (pathItem === '/')  {
        doInboxGET_Index(req,res,opts);
    }
    else if (pathItem.match(/^\/[A-Za-z0-9_-]+\.jsonld$/)) {
        doInboxGET_Read(req,res,opts);
    }
    else {
        res.writeHead(403);
        res.end('Forbidden');
    }
}

function doInboxHEAD(req,res,opts) {
    const pathItem = req.url.substring(opts['url'].length);
    const id = pathItem.substring(1);

    logger.debug(`doInboxHEAD (for ${pathItem})`);

    if (pathItem === '/')  {
        const meta = getBody(`${id}.meta`,opts);
    
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
        const result = getBody(id,opts);

        if (! result) {
            res.writeHead(403);
            res.end('Forbidden');
            return;
        }

        const meta = getBody(`${id}.meta`,opts);
        
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

function doInboxGET_Index(req,res,opts) {
    const notifications = listInbox(opts).map( (e) => {
        return opts['base'] + '/' + opts['url'] + e;
    });

    const result = {
        "@context": "http://www.w3.org/ns/ldp",
        "@id": opts['base'] + '/' + opts['url'],
        "contains": notifications
    };

    const meta = getBody(`.meta`,opts);
        
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

function doInboxGET_Read(req,res,opts) {
    const pathItem = req.url.substring(opts['url'].length);
    const id = pathItem.substring(1);
    const result = getBody(id,opts);

    if (result) {
        const meta = getBody(`${id}.meta`,opts);
        
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

function doInboxPOST(req,res,opts) {
    const pathItem = req.url.substring(opts['url'].length);

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
        if (checkBody(postData,opts)) {
            const id = storeBody(postData,opts);
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

function listInbox(opts) {
    const glob = new RegExp("^.*\\.jsonld$");

    logger.debug(`listInbox()`);

    try {
        const entries = fs.readdirSync(opts['inbox']).filter( (file) => {
            return file.match(glob);
        });
        return entries;
    }
    catch(e) {
        logger.error(e);
        return [];
    }
}

function getBody(id,opts) {
    logger.debug(`getBody(${id})`);

    try {
        return fs.readFileSync(opts['inbox'] + '/' + id, {encoding : 'utf-8'});
    }
    catch(e) {
        return null;
    }
}

function storeBody(data,opts) {
    try {
        const id = md5(data);
        const newpath = `${opts['inbox']}/${id}.jsonld`;

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

function checkBody(data,opts) {
    if (! (opts['schema'] && fs.existsSync(opts['schema']))) {
        logger.debug(`no JSON_SCHEMA found`);
        return true;
    }
    try {
        const JSON_SCHEMA = JSON.parse(fs.readFileSync(opts['schema'], { encoding: 'utf-8'}));
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
    doInbox,
    getLogger , 
    parseAsJSON ,
    backOff_fetch , 
    fetchOriginal ,
    moveTo ,
    sendNotification ,
    handle_inbox ,
    generateId
};