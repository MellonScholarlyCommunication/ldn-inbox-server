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

Start an inbox handler: 

```
npx ldn-inbox-server handle-inbox 
```

## Environment

- `LOG4JS` : log4js logging level
- `LDN_SERVER_HOST` : default LDN inbox host
- `LDN_SERVER_PORT` : default LDN inbox port
- `LDN_SERVER_INBOX_URL` : default LDN inbox url (path)
- `LDN_SERVER_INBOX_PATH` : default LDN inbox path
- `LDN_SERVER_ERROR_PATH` : default LDN error path
- `LDN_SERVER_OUTBOX_PATH` : default LDN outbox path
- `LDN_SERVER_PUBLIC_PATH` : default public (HTML) path
- `LDN_SERVER_JSON_SCHEMA` : default notification JSON validation schema

## Extend

Server extensions are possible by providing custom inbox and notification handlers. E.g.

```
npx ldn-inbox-server handle-inbox --inbox_handler ../handler/demo_inbox_handler --notification_handler ../handler/demo_notification_handler.js
```

## See also

- [mellon-server](https://www.npmjs.com/package/mellon-server)