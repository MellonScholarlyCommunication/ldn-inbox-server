const { setTimeout } = require('timers/promises');

// Default notification handler that does nothing
async function handle({path,options}) {
    try {
        console.log(path);
        console.log(options);
        await setTimeout(1000);
        return { path, options, success: true };
    }
    catch (e) {
        return { path, options, success: false };
    }
}

module.exports = { handle };