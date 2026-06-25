
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
    generateId,
    generatePublished,
    parseConfig
} = require('../lib/util');
const { handle_inbox } = require('../lib/handler');
const logger = getLogger();

// in-memory per-IP fixed-window rate limiter (fallback when no reverse proxy)
const rateBuckets = new Map();

function rateLimited(ip,limit,windowMs) {
    if (! limit || limit <= 0) return false;

    const now = Date.now();
    let bucket = rateBuckets.get(ip);

    if (! bucket || now >= bucket.reset) {
        bucket = { count: 0, reset: now + windowMs };
        rateBuckets.set(ip,bucket);
    }

    bucket.count++;

    // opportunistic purge of expired buckets to bound memory
    if (rateBuckets.size > 10000) {
        for (const [k,v] of rateBuckets) {
            if (now >= v.reset) rateBuckets.delete(k);
        }
    }

    return bucket.count > limit;
}

function doInbox(req,res,opts) {
    if (req.method === 'GET') {
        doInboxGET(req,res,opts);
    }
    else if (req.method == 'HEAD') {
        doInboxHEAD(req,res,opts);
    }
    else if (req.method === 'POST' && opts['inboxWriteable'] == 1) {
        doInboxPOST(req,res,opts);
    }
    else if (req.method === 'OPTIONS') {
        doInboxOPTIONS(req,res,opts);
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

function doInboxOPTIONS(req,res,opts) {
    const pathItem = req.url.substring(opts['url'].length);
    const id = pathItem.substring(1);

    logger.debug(`doInboxOPTIONS (for ${pathItem})`);

    if (pathItem === '/')  {
        const meta = getBody(`${id}.meta`,opts);
   
        let metadata = {};

        if (meta) {
            metadata = JSON.parse(meta);
        }

        const allow = ['GET','HEAD','OPTIONS'];

        if (opts['inboxWriteable'] == 1) {
            allow.push('POST');
            metadata['Accept-Post'] = 'application/ld+json';
        }

        metadata['Allow'] = allow.join(",");

        logger.debug(metadata);

        res.setHeader('Access-Control-Allow-Origin','*');
        res.setHeader('Access-Control-Allow-Headers','*');

        for (let property in metadata) {
            if (property !== 'Content-Type') {
                res.setHeader(property,metadata[property]);
            }
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
       
        let metadata = {};

        if (meta) {
            metadata = JSON.parse(meta);
        }
        
        const allow = ['OPTIONS'];

        if (opts['inboxPublic'] == 1) {
            allow.push('GET');
            allow.push('HEAD');
        }

        metadata['Allow'] = allow.join(",");

        logger.debug(metadata);

        for (let property in metadata) {
            if (property !== 'Content-Type') {
                res.setHeader(property,metadata[property]);
            }
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

function doInboxHEAD(req,res,opts) {
    const pathItem = req.url.substring(opts['url'].length);
    const id = pathItem.substring(1);

    logger.debug(`doInboxHEAD (for ${pathItem})`);

    if (pathItem === '/')  {
        const meta = getBody(`${id}.meta`,opts);
   
        res.setHeader('Access-Control-Allow-Origin','*');
        res.setHeader('Access-Control-Allow-Headers','*');
        res.setHeader('Content-Type','application/ld+json');

        if (meta) {
            const metadata = JSON.parse(meta);
            for (let property in metadata) {
                res.setHeader(property,metadata[property]);
            }
        }

        res.writeHead(200);
        res.end();
        return;
    }

    if (pathItem.match(/^\/[A-Za-z0-9_-]+\.jsonld$/) && opts['inboxPublic'] == 1) {
        const result = getBody(id,opts);

        if (! result) {
            res.writeHead(403);
            res.end('Forbidden');
            return;
        }

        const meta = getBody(`${id}.meta`,opts);
        
        res.setHeader('Content-Type','application/ld+json');

        if (meta) {
            const metadata = JSON.parse(meta);
            for (let property in metadata) {
                res.setHeader(property,metadata[property]);
            }
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
    let notifications = [];

    if (opts['inboxPublic'] == 1) {
        notifications = listInbox(opts).map( (e) => {
            return opts['base'] + '/' + opts['url'] + e;
        });
    }

    const result = {
        "@context": "http://www.w3.org/ns/ldp",
        "@id": opts['base'] + '/' + opts['url'],
        "contains": notifications
    };

    const meta = getBody(`.meta`,opts);
       
    res.setHeader('Access-Control-Allow-Origin','*');
    res.setHeader('Content-Type','application/ld+json');

    if (meta) {
        const metadata = JSON.parse(meta);
        for (let property in metadata) {
            res.setHeader(property,metadata[property]);
        }
    }

    res.writeHead(200);
    res.end(JSON.stringify(result,null,2));
}

function doInboxGET_Read(req,res,opts) {
    const pathItem = req.url.substring(opts['url'].length);
    const id = pathItem.substring(1);
    const result = getBody(id,opts);

    if (result && opts['inboxPublic'] == 1) {
        const meta = getBody(`${id}.meta`,opts);
        
        res.setHeader('Access-Control-Allow-Origin','*');
        res.setHeader('Content-Type','application/ld+json');

        if (meta) {
            const metadata = JSON.parse(meta);
            for (let property in metadata) {
                res.setHeader(property,metadata[property]);
            }
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
    const limit = parseInt(opts['rateLimit']) || 0;

    if (limit > 0) {
        const windowSec = parseInt(opts['rateWindow']) || 60;
        const ip = req.socket.remoteAddress;
        if (rateLimited(ip,limit,windowSec * 1000)) {
            logger.error(`rate limit exceeded for ${ip} (${limit} per ${windowSec}s)`);
            res.setHeader('Retry-After',windowSec);
            res.writeHead(429);
            res.end('Too Many Requests');
            return;
        }
    }

    const pathItem = req.url.substring(opts['url'].length);

    if (pathItem !== '/') {
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

    const maxSize = parseInt(opts['maxUploadSize']) || 0;

    if (maxSize > 0 && headers['content-length'] && parseInt(headers['content-length']) > maxSize) {
        logger.error(`content-length ${headers['content-length']} exceeds max upload size ${maxSize}`);
        res.writeHead(413);
        res.end('Payload Too Large');
        return;
    }

    let postData = ''
    let postSize = 0;
    let tooLarge = false;
    req.on('data', (data) => {
        if (tooLarge) return;
        postSize += data.length;
        if (maxSize > 0 && postSize > maxSize) {
            tooLarge = true;
            logger.error(`upload exceeds max upload size ${maxSize}`);
            res.writeHead(413);
            res.end('Payload Too Large');
            req.destroy();
            return;
        }
        postData += data;
    });
    req.on('end',() => {
        if (tooLarge) return;
        logger.debug(postData);
        res.setHeader('Access-Control-Allow-Origin','*');
        if (checkBody(postData,opts)) {
            const id = storeBody(postData,opts);

            if (! id) {
                logger.error(`failed to store notification`);
                res.writeHead(500);
                res.end('Failed to store notification');
                return;
            }

            storeMetadata(id,opts);
            if (opts['inboxPublic'] == 1) {
                const message = `Accepted ${req.url}${id}`;
                logger.debug(message);
                res.setHeader('Location',`${req.url}${id}`);
                res.writeHead(201);
                res.end(message);
            }
            else {
                const message = JSON.stringify({"message":"Request accepted"});
                logger.debug(`202 : ${message}`);
                res.writeHead(202);
                res.end(message);
            }
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

function storeMetadata(id,opts) {
    try {
        const newpath = `${opts['inbox']}/${id}.jsonld.meta`;

        const meta = getBody(`.meta`,opts);
   
        if (! fs.existsSync(newpath)) {

            if (meta) {
                logger.debug(`storing ${newpath}`);
                fs.writeFileSync(newpath,meta);
            }
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
    if (! opts['schema'] || ! fs.existsSync(opts['schema'])) {
        logger.debug(`no JSON_SCHEMA found`);
        return true;
    }
    else {
        logger.debug(`using schema: ${opts['schema']}`);
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
    generateId , 
    generatePublished ,
    parseConfig
};