#!/usr/bin/env node

const fs = require('fs');
const { program } = require('commander');
const { sendNotification, getLogger } = require('../lib/util.js');
require('dotenv').config();

const logger = getLogger();

const INBOX_URL = process.env.LDN_SERVER_INBOX_URL ?? 'inbox/';
const INBOX_BASE_URL = process.env.LDN_SERVER_BASEURL ?? 'http://localhost:8000';

program
  .name('post-notification')
  .description('A LDN notification sender')
  .argument('<url>','notification')
  .argument('<file>','notification')
  .action( async(url,file) => {
     const to = url === '@me' ? `${INBOX_BASE_URL}/${INBOX_URL}` : url;
     const json = JSON.parse(fs.readFileSync(file, { encoding: 'utf-8'}));
     await sendNotification(to,json);  
  });

program.parse();