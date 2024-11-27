#!/usr/bin/env node

const fs = require('fs');
const { program } = require('commander');
const { start_server } = require('mellon-server');
const { doInbox }      = require('../lib/index');
const { handle_inbox } = require('../lib/handler');
const { parseConfig }  = require('../lib/util');
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
const JSON_SCHEMA_PATH = process.env.LDN_SERVER_JSON_SCHEMA; 
const INBOX_CONFIG = process.env.LDN_SERVER_INBOX_CONFIG;
const OUTBOX_CONFIG = process.env.LDN_SERVER_OUTBOX_CONFIG;
const HAS_PUBLIC = process.env.LDN_SERVER_HAS_PUBLIC_INBOX ?? 0;
const HAS_WRITE = process.env.LDN_SERVER_HAS_WRITABLE_INBOX ?? 1;
const OTHER_CONFIG = process.env.LDN_SERVER_OTHER_CONFIG;

program
  .name('lnd-inbox-server')
  .description('A demonstration Event Notifications Inbox server');

program
  .command('start-server')
  .option('--host <host>','host',HOST)
  .option('--port <port>','port',PORT)
  .option('--config <config>','config',OTHER_CONFIG)
  .option('--url <path>','path',INBOX_URL)
  .option('--base <url>','base url',INBOX_BASE_URL)
  .option('--inbox <inbox>','inbox',INBOX_PATH)
  .option('--public <public>','public',PUBLIC_PATH)
  .option('--schema <schema>','json schema',JSON_SCHEMA_PATH)
  .option('--registry <registry>','registry',null)
  .option('--inbox-public','public readable inbox',HAS_PUBLIC)
  .option('--inbox-writeable','public writable inbox',HAS_WRITE)
  .action( (options) => {
      let registry = [];

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

      if (options['config'] && fs.existsSync(options['config'])) {
          const config = parseConfig(options['config']);
          if (config.registry) {
             for (let i = 0 ; i < config.registry.length ; i++) {
                const registry_item = config.registry[i];
                if (! registry_item['do']) {
                  registry_item['do'] = doInbox;
                }
                registry_item['with'] = {...options,...registry_item['with']};
                registry = registry.concat(registry_item);
             }
          }
      }
      else {
        registry = registry.concat({ path : `${options['url']}.*` , do: doInbox , with: options}); 
      }
   
      start_server({
        host: options['host'],
        port: options['port'],
        base: options['base'],
        public: options['public'],
        registry: registry
      });
  });

program
  .command('handler')
  .option('--base <url>','base url',INBOX_BASE_URL)
  .option('--inbox <inbox>','inbox',INBOX_PATH)
  .option('--outbox <outbox>','outbox',OUTBOX_PATH)
  .option('--public <public>','public',PUBLIC_PATH)
  .option('--error <errbox>','errbox',ERROR_PATH)
  .option('--loop', 'run in a loop')
  .option('--batch_size <num>','batch size to process',INBOX_BATCH_SIZE)
  .option('--glob <glob>','files to process in inbox',INBOX_GLOB)
  .option('--config <path>','config file for handlers')
  .option('-hi,--inbox_handler <handler>','inbox handler')
  .option('-hn,--notification_handler <handler>','notification handler')
  .option('-s,--single <notification>','handle this one specific notification')
  .argument('<box>','box to process')
  .action( async(box,options) => {
    switch (box) {
      case '@inbox':
        box = INBOX_PATH;
        if (!options['config']) {
          options['config'] = INBOX_CONFIG
        }
        break;
      case '@outbox':
        box = OUTBOX_PATH;
        if (!options['config']) {
          options['config'] = OUTBOX_CONFIG
        }
        break;
    }

    if (! fs.existsSync(options['config'])) {
      console.error(`can't open ${options['config']}`);
    }
    else {
      await handle_inbox(box,options);
    }
  });

program.parse();