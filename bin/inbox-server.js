#!/usr/bin/env node

const { program } = require('commander');
const { inbox_server } = require('../index.js');

const HOST = 'localhost'
const PORT = 8000;
const PUBLIC_PATH = './public';
const INBOX_PATH = './inbox';
const JSON_SCHEMA_PATH = './config/offer_schema.json';

program
  .name('inbox-server')
  .version('1.0.0')
  .description('A demonstration Event Notifications Inbox server');

program
  .command('start-server')
  .option('--host <host>','host',HOST)
  .option('--port <port>','port',PORT)
  .option('--inbox <inbox>','inbox',INBOX_PATH)
  .option('--public <public>','public',PUBLIC_PATH)
  .option('--schema <schema>','json schema',JSON_SCHEMA_PATH)
  .action( (options) => {
    inbox_server(options);
  });

program.parse();