const { start_server } = require('mellon-server');
const Validator = require('jsonschema').Validator;
const fs = require('fs');
const md5 = require('md5');
const { v4: uuidv4 } = require('uuid');
const fetch = require('node-fetch');

let INBOX_PATH = './inbox';
let JSON_SCHEMA = '';

function inbox_server(options) {
    INBOX = options['inbox'];
    JSON_SCHEMA = JSON.parse(fs.readFileSync(options['schema'], { encoding: 'utf-8'}));
    let registry = [{ path : 'inbox/.*' , do: doInbox }];

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

async function handle_inbox(path,handler,options) {
    delete require.cache[handler];
    const func = require(handler).handleInbox;
    await func(path,options);
}

function doInbox(req,res) {
    if (req.method !== 'POST') {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    const headers = req.headers;

    if (headers && (
        headers['content-type'] === 'application/ld+json' ||
        headers['content-type'] === 'application/json'
        )
    ) {
        // We are ok
    }
    else {
        res.writeHead(400);
        res.end(`Need a Content-Type 'application/ld+json'`);
        return;
    }

    let postData = ''
    req.on('data', (data) => {
        postData += data;
    });
    req.on('end',() => {
        if (checkBody(postData)) {
            const id = storeBody(postData);
            res.setHeader('Location',`${req.url}${id}`);
            res.writeHead(201);
            res.end(`Accepted ${req.url}${id}`);
        }
        else {
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
            fs.writeFileSync(newpath,data);
        }

        return `${id}.jsonld`;
    }
    catch (e) {
        return null;
    }
}

function checkBody(data) {
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
        return false;
    }
}

async function sendNotification(url,json, options) {
    if (!json['@context']) {
        json['@context'] = "https://www.w3.org/ns/activitystreams";
    }

    if (!json['id']) {
        json['id'] = 'urn:uuid:' + uuidv4();
    }

    let fetcher = options['fetch'] ?? fetch;

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

module.exports = { inbox_server , handle_inbox , sendNotification };