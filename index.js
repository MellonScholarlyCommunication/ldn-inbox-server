const { program } = require('commander');
const { start_server , doFile } = require('mellon-server');
const Validator = require('jsonschema').Validator;
const fs = require('fs');
const md5 = require('md5');

const HOST = 'localhost'
const PORT = 8000;
const INBOX_PATH = './inbox';
const PUBLIC_PATH = './public';
const JSON_SCHEMA_PATH = './config/offer_schema.json';

program
  .option('--host <host>','host',HOST)
  .option('--port <port>','port',PORT)
  .option('--inbox <inbox>','inbox','INBOX_PATH')
  .option('--public <public>','public',PUBLIC_PATH)
  .option('--schema <schema>','json schema',JSON_SCHEMA_PATH);

program.parse();

const options = program.opts();

const JSON_SCHEMA = JSON.parse(fs.readFileSync(options['schema'], { encoding: 'utf-8'}));

start_server({
    host: options['host'],
    port: options['port'],
    public: options['public'],
    registry: {
        'inbox/' : doInbox
    }
});

function doInbox(req,res) {
    if (req.method !== 'POST') {
        return doFile('public/api/register/index.html',req,res);
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
            res.writeHead(202);
            res.end(`Accepted ${id}`);
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

        return id;
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

