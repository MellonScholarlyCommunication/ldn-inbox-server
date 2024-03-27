const { start_server } = require('mellon-server');
const Validator = require('jsonschema').Validator;
const fs = require('fs');
const md5 = require('md5');

let INBOX_PATH = './inbox';
let JSON_SCHEMA = '';

function inbox_server(options) {
    INBOX = options['inbox'];
    JSON_SCHEMA = JSON.parse(fs.readFileSync(options['schema'], { encoding: 'utf-8'}));
    start_server({
        host: options['host'],
        port: options['port'],
        public: options['public'],
        registry: [
          { path : 'inbox/.*' , do: doInbox }
        ]
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

module.exports = { inbox_server , handle_inbox };