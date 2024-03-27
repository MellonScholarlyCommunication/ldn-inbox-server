const fs = require('fs');

async function handleInbox(path,options) {

    fs.readdir(path, (err,files) => {
        files.forEach( (file) => {
            const fullPath = `${path}/${file}`;
            if (file.match("^\\..*$")) {
                // Ignore
            }
            else if (file.match("^.*\\.jsond$")) {
                // Process
                console.log(`Deleting ${fullPath}...`);
                fs.unlinkSync(fullPath);
            }
            else {
                fs.unlinkSync(fullPath);
            }
        });
    });
}

module.exports = { handleInbox };