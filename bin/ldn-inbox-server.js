#!/usr/bin/env node

const fs = require('fs');
const { program } = require('commander');
const { inbox_server } = require('../lib/index');
const { handle_inbox } = require('../lib/handler');
require('dotenv').config();

const HOST = process.env.LDN_SERVER_HOST ?? 'localhost';
const PORT = process.env.LDN_SERVER_PORT ?? 8000;
const INBOX_GLOB = process.env.LDN_SERVER_INBOX_GLOB ?? "^.*\\.jsonld$";
const INBOX_BATCH_SIZE = process.env.LDN_SERVER_INBOX_BATH_SIZE ?? 5;
const INBOX_URL = process.env.LDN_SERVER_INBOX_URL ?? 'inbox/';
const INBOX_BASE_URL = process.env.LDN_SERVER_BASEURL ?? 'http://localhost:8000';
const PUBLIC_PATH = process.env.LDN_SERVER_PUBLIC_PATH ?? './public';
const INBOX_PATH = process.env.LDN_SERVER_INBOX_PATH ?? './inbox';
const ERROR_PATH = process.env.LDN_SERVER_ERROR_PATH ?? './error';
const OUTBOX_PATH = process.env.LDN_SERVER_OUTBOX_PATH ?? './outbox';
const JSON_SCHEMA_PATH = process.env.LDN_SERVER_JSON_SCHEMA ?? './config/notification_schema.json';
const INBOX_CONFIG = process.env.LDN_SERVER_INBOX_CONFIG;
const OUTBOX_CONFIG = process.env.LDN_SERVER_OUTBOX_CONFIG;
const HAS_PUBLIC = process.env.LDN_SERVER_HAS_PUBLIC_INBOX ?? 0;

program
  .name('lnd-inbox-server')
  .description('A demonstration Event Notifications Inbox server');

program
  .command('start-server')
  .option('--host <host>','host',HOST)
  .option('--port <port>','port',PORT)
  .option('--url <path>','path',INBOX_URL)
  .option('--base <url>','base url',INBOX_BASE_URL)
  .option('--inbox <inbox>','inbox',INBOX_PATH)
  .option('--public <public>','public',PUBLIC_PATH)
  .option('--schema <schema>','json schema',JSON_SCHEMA_PATH)
  .option('--registry <registry>','registry',null)
  .option('--inbox-public','public readable inbox',HAS_PUBLIC)
  .action( (options) => {
    inbox_server(options);
  });

program
  .command('handler')
  .option('--base <url>','base url',INBOX_BASE_URL)
  .option('--inbox <inbox>','inbox',INBOX_PATH)
  .option('--outbox <outbox>','outbox',OUTBOX_PATH)
  .option('--public <public>','public',PUBLIC_PATH)
  .option('--error <errbox>','errbox',ERROR_PATH)
  .option('--loop <seconds>', 'run in a loop',0)
  .option('--batch_size <num>','batch size to process',INBOX_BATCH_SIZE)
  .option('--glob <glob>','files to process in inbox',INBOX_GLOB)
  .option('--config <path>','config file for handlers')
  .option('-hi,--inbox_handler <handler>','inbox handler')
  .option('-hn,--notification_handler <handler>','notification handler')
  .argument('<box>','box to process')
  .action( async(box,options) => {
    switch (box) {
      case '@inbox':
        box = INBOX_PATH;
        if (!options['config'] && fs.existsSync(INBOX_CONFIG)) {
            options['config'] = INBOX_CONFIG
        }
        break;
      case '@outbox':
        box = OUTBOX_PATH;
        if (!options['config'] && fs.existsSync(OUTBOX_CONFIG)) {
          options['config'] = OUTBOX_CONFIG
      }
        break;
    }
    await handle_inbox(box,options);
  });

program.parse();