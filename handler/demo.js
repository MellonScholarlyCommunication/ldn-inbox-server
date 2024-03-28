const fs = require('fs');

async function handleInbox(path,options) {
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

module.exports = { handleInbox };