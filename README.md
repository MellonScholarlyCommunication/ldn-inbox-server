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

Copy an example JSON Schema as `config/offer_schema.json` from this project.

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
npx ldn-inbox-server handle-inbox ./handler/demo.js
```

where `./handler/demo.js` contains a `handleInbox` function to process the inbox/

Example handler:

```
async function handleInbox(path,options) {
    console.log(path);
}

module.exports = { handleInbox };
```