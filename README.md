# ldn-inbox-server

An experimental LDN inbox server for [Event Notification](https://www.eventnotifications.net) messages.

## Install

```
yarn add ldn-inbox-server
```

## Example

Create required directories

```
mkdir config inbox public
```

Copy an example JSON Schema as `config/notification_schema.json` from this project.

Start the server:

```
npx ldn-inbox-server start-server --port 8000
```

Send a demonstration Event Notifications message:

```
curl -X POST -H 'Content-Type: application/ld+json' --data-binary '@examples/offer.jsonld' http://localhost:8000/inbox/
```

Start an inbox handler with a demo handler (that creates an `Accept` message in the `./outbox`).

```
npx ldn-inbox-server handler @inbox -hn ./handler/accept_notification_handler.js
```

Start an outbox handler that send the notifications that are available outbox:

```
npx ldn-inbox-server handler @outbox -hn ./handler/send_notification_handler.js
```

## Environment

- `LOG4JS` : log4js logging level
- `LDN_SERVER_HOST` : LDN inbox host
- `LDN_SERVER_PORT` : LDN inbox port
- `LDN_SERVER_INBOX_URL` : LDN inbox url (path)
- `LDN_SERVER_INBOX_PATH` : LDN inbox path
- `LDN_SERVER_ERROR_PATH` : LDN error path
- `LDN_SERVER_OUTBOX_PATH` : LDN outbox path
- `LDN_SERVER_PUBLIC_PATH` : public (HTML) path
- `LDN_SERVER_JSON_SCHEMA` : notification JSON validation schema
- `LDN_SERVER_BASEURL` : baseurl of the LDN inbox server
- `LDN_SERVER_INBOX_GLOB` : glob of files to process in inbox directory
- `LDN_SERVER_HAS_PUBLIC_INBOX` : if true, then public read access is allowed on inbox

## Extend

Server extensions are possible by providing custom inbox and notification handlers. E.g.

```
npx ldn-inbox-server handler @inbox -hn handler/my_handler.js
```

Or, in JavaScript:

```
const { handle_inbox } = require('ldn-inbox-handler');

main();

async function main() {
    await handle_inbox('./inbox', {
        'inbox': './inbox',
        'outbox': './outbox',
        'public': './public',
        'error': './error',
        'batch_size': 5,
        'glob': '^.*\\.jsonld$',
        'config': './config/inbox_config.json',
        'notification_handler': 'handler/my_handler.js' 
    });
}
```

with `my_handler.js` :

```
async function handle({path,options}) {
    //...

    return { path, options, success: true };
}

module.exports = { handle };
```

## Hints

A handler can be started on any directory. E.g. a workflow might be:

- have an "inbox" handler to validate incoming LDN messages
- valid LDN messages will be saved into the "accepted" box
- invalid LDN messages will be saved into the "error" box
- have an "accepted" handler to process valid LDN messages
- processed LDN messages will end up in the "outbox" box
- invalid processing will be saved into the "error" box  

## Handlers

### Accept handler

A handler that creates for an incoming notification an `Accept` notification in the `@outbox`.

### Evenlog handler

A handler that updates an event log with the incoming notification. 

Requires a configuration properties:

- `log`: the path to the event log (starting from the `public` directory)
- `dir`: the path to a container to store the events (starting from the `public` directory)

The `log` and `dir` path may contain a `@artifact(:strip)?@` directive to fill in the
path of the current artifact. The `:strip` filter is used to strip an artifact path of a file extension. E.g. `path/artifact.html` becomes `path/artifact` when using a `:strip`.

### Multi handler

A `handler/multi_notification_handler.js` is available to start multiple handler for each notification messages. The handlers to start are specified in a configuraton file that can be passed via the `config` parameter of an `handle_inbox`. In the commmand line tool `bin/ldn-inbox-server` the default location of such config file is `config/inbox_config.json` when processing an `@inbox`, and `config/outbox_config.json` when processing an `@outbox`.

### Offer memento handler

A handler to `Offer` an event log to a memento server.

Requires a configuration properties:

- `actor`: the LDN+AS2 `actor` to use in a notification
- `target`: the LDN+AS2 `target` to use in a notification

### Send handler

A hanlder to send notification that live in the `@outbox` via the LDN protocol to the LDN `target`.

### Valid artifact

A handler that validates the incoming notification and checks if the `object` or `context` contains an artifact that is part of the `public` resources. See 'Artifact support' below.

## Artifact support 

This code base contains Event Notifications support for Data Node artifacts. See the examples
in `public/artifacts-example`. Move this directory tp `public/artifacts` to get a running example.

- Each artifact requires at least a `.meta` file with the `X-Artifact` header set to `true` to be recognized by the software as an artifact
- Each artifact should update the `Link-Template` header in the `.meta` file
- The config files in `config/inbox_config.json` and `config/outbox_config.json` define the location of the possible event logs for the artifact
  
## See also

- [mellon-server](https://www.npmjs.com/package/mellon-server)