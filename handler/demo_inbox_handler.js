const fs = require('fs');

/** 
 * Demonstration of an alternatve inbox handler
 *   (don't use it the one in lib/handler.js is much more mature)
 * To use it set it via the `--hi` option of `bin/ldn-inbox-server.js`, or
 * the `inbox_handler` option of the `handle_inbox` function.
 */
async function handle({path,options}) {
    console.log(`handleInbox(${path},..)`);
    fs.readdir(path, (err,files) => {
        files.forEach( (file) => {
            const fullPath = `${path}/${file}`;
            if (file.match("^\\..*$")) {
                // Ignore
            }
            else if (file.match("^.*\\.jsonld$")) {
                // Process
                console.log(`Found ${fullPath} (deleting)`);
                fs.unlinkSync(fullPath);
            }
            else {
                // Unknown file
                console.log(`Unknown entry ${fullPath} (deleting)`);
                fs.unlinkSync(fullPath);
            }
        });
    });
}

module.exports = { handle };