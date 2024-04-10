#!/usr/bin/env node

const { program } = require('commander');
const { inbox_server } = require('../lib/index');
const { handle_inbox , defaultSendNotificationHandler } = require('../lib/handler');
require('dotenv').config();

const HOST = process.env.LDN_SERVER_HOST ?? 'localhost';
const PORT = process.env.LDN_SERVER_PORT ?? 8000;
const INBOX_URL = process.env.LDN_SERVER_INBOX_URL ?? 'inbox/';
const PUBLIC_PATH = process.env.LDN_SERVER_PUBLIC_PATH ?? './public';
const INBOX_PATH = process.env.LDN_SERVER_INBOX_PATH ?? './inbox';
const ERROR_PATH = process.env.LDN_SERVER_ERROR_PATH ?? './error';
const OUTBOX_PATH = process.env.LDN_SERVER_OUTBOX_PATH ?? './outbox';
const JSON_SCHEMA_PATH = process.env.LDN_SERVER_JSON_SCHEMA ?? './config/notification_schema.json';

program
  .name('lnd-inbox-server')
  .version('1.1.1')
  .description('A demonstration Event Notifications Inbox server');

program
  .command('start-server')
  .option('--host <host>','host',HOST)
  .option('--port <port>','port',PORT)
  .option('--url <url>','url',INBOX_URL)
  .option('--inbox <inbox>','inbox',INBOX_PATH)
  .option('--public <public>','public',PUBLIC_PATH)
  .option('--schema <schema>','json schema',JSON_SCHEMA_PATH)
  .option('--registry <registry>','registry',null)
  .action( (options) => {
    inbox_server(options);
  });

program
  .command('handler')
  .option('--inbox <inbox>','inbox',INBOX_PATH)
  .option('--outbox <outbox>','outbox',OUTBOX_PATH)
  .option('--error <errbox>','errbox',ERROR_PATH)
  .option('-hi,--inbox_handler <handler>','inbox handler')
  .option('-hn,--notification_handler <handler>','notification handler')
  .argument('<box>','box to process')
  .action( async(box,options) => {
    switch (box) {
      case '@inbox':
        box = INBOX_PATH;
        break;
      case '@outbox':
        box = OUTBOX_PATH;
        options['notification_handler'] =
           options['notification_handler'] ?? defaultSendNotificationHandler;
        break;
    }
    await handle_inbox(box,options);
  });

  program.parse();