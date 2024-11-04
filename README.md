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
- `LDN_SERVER_HAS_PUBLIC_INBOX` : if true, then public read access is allowed on the inbox
- `LDN_SERVER_HAS_WRITABLE_INBOX` : if true, then public write access is allowed on the inbox
  
## Multiple inboxes

Instead of a single inbox, multiple inboxes can be configured by adding a JSON configuration file to the installation. The JSON file should contain a `registry` entry with contains an array of inbox configuration. An example:

```
{
  "registry": [
        { "path": "inbox/.*" , 
          "with": {
            "url": "inbox/",
            "inbox": "./inbox",
            "inboxPublic": 1,
            "inboxWritable": 1,
            "schema": "./config/schema1.json"
        }},
        { "path": "inbox2/.*" , 
          "with": {
            "url": "inbox2/",
            "inbox": "./inbox2",
            "inboxPublic": 1,
            "inboxWritable": 0,
            "schema": "./config/schema2.json"
        }}
    ]
}
```

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

### Eventlog handler

A handler that updates an event log with the incoming notification. 

Requires configuration properties:

- `log`: the path to the event log (starting from the `public` directory)
- `dir`: the path to a container to store the events (starting from the `public` directory)

The `log` and `dir` path may contain a `@artifact(:strip)?@` directive to fill in the
path of the current artifact. The `:strip` filter is used to strip an artifact path of a file extension. E.g. `path/artifact.html` becomes `path/artifact` when using a `:strip`.

### Json Path handler

A handler that accepts a notifiction when it matches one or more JSON paths

Requires configuration properties:

- anyOf : an array of json path matchers, the combination should be interpreted as a logical `OR`.
   - every json path matcher is an array of single matchers, the combination should be interpered as a logical `AND`.
  
A single matcher needs two properties:

- path : a json path
- value : a value

The json path matches when one of:

- On the json path an array is found and the value is included in the array
- On the json path a string or number is found and the value is equal to this string or number

### Multi handler

A `handler/multi_notification_handler.js` is available to start multiple handler for each notification messages. The handlers to start are specified in a configuration file that can be passed via the `config` parameter of an `handle_inbox`. For the commmand line tool `bin/ldn-inbox-server` the default location of such config file is `config/inbox_config.json` when processing an `@inbox`, and `config/outbox_config.json` when processing an `@outbox`.

The multi handler requires a configuration file with properties `notification_handler.multi.handlers` which is an array of array. Each outer array defines a workflow: a list of handlers that should be executed sequentially on a notification until one handler returns a `success=false` response or the last handler returns a `success=true` response, or a handler returns `break=true` (which will skip all other steps in a workflow). The multi handler is successful when at least one workflow could be completed with success.

Each handler is defined by a hash containing as `id` property the path to the handler and optionally other property keys that will be passed to the handlers in the `config` section.

Optionally when a `fallback` handler is defined as option it will be attempted when a handler in a sequence returns a `false` response.

### On Error handler

A handler that sets the `fallback` for a workflow sequence.

### Offer memento handler

A handler to `Offer` an event log to a memento server.

Requires configuration properties:

- `actor`: the LDN+AS2 `actor` to use in a notification
- `target`: the LDN+AS2 `target` to use in a notification

### Send notification handler

A handler to send notification that live in the `@outbox` via the LDN protocol to the LDN `target`.

If the environoment `DEMO_MODE=NO_NOTIFICATIONS` is set, no real notifications will be sent.

### Type handler

A handler that accepts any notification with a type that matches one of the `anyOf` types.

### Valid artifact handler

A handler that validates the incoming notification and checks if the `object` or `context` contains an artifact that is part of the `public` resources. See 'Artifact support' below.

Generates the following options keys:

- artifact.id : the URL of the artifact
- artifact.path : the local path to the artifact

### Valid event log handler

A hander that validates the incoming notification and checks if the `object` or `context` contains an event log that is part of the `public` resources.

Generates the following options keys:

- eventlog.id : the URL of the event log
- eventlog.path : the local path of the event log

## Artifact support 

This code base contains Event Notifications support for Data Node artifacts. See the examples
in `public/artifacts-example`. Move this directory tp `public/artifacts` to get a running example.

- Each artifact requires at least a `.meta` file with the `X-Artifact` header set to `true` to be recognized by the software as an artifact
- Each artifact should update the `Link-Template` header in the `.meta` file
- The config files in `config/inbox_config.json` and `config/outbox_config.json` define the location of the possible event logs for the artifact

## API

### getLogger()

Returns a LOG4JS logger instance.

### fetchOriginal(url) 

Resolve the url and return the textual body.

### backOff_fetch(url,options)

Return the result of `fetch(url,options)` (tries many times untill the server responds).

### sendNotification(url,payload,options)

Send to `url` the payload uptionally a `fetch` can be provided in the options.

### moveTo(oldPath, newPath)

Move a file from an oldPath to a newPath .

### parseAsJSON(path)

Parse the path into a JSON document (or return null when failed).

### generateId()

Generate a uuid URN.

### generatePublished()

Generate a ISO8601 date time string.

### parseConfig(path)

Parse a path containing `.json` | `.jsonld` | `.json5` | `.yaml` | `.yml` into a
JavaScript object.

## See also

- [mellon-server](https://www.npmjs.com/package/mellon-server)