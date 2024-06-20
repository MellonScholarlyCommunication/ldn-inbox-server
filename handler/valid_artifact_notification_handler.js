const { ldPropertyAsId , parseArtifact, parseAsJSON } = require('../lib/util.js');
const logger = require('../lib/util.js').getLogger();

/**
 * Demonstration notification handler, that checks if the notification
 * message contains an artifact that is known to the data node
 */
async function handle({path,options,config}) {
    logger.info(`parsing notification ${path}`);
    
    try {
        const json = parseAsJSON(path);
        
        let artifact = undefined;

        if (ldPropertyAsId(json['context'])) {
            artifact = ldPropertyAsId(json['context']);
        }
        else if (ldPropertyAsId(json['object'])) {
            artifact = ldPropertyAsId(json['object']);
        }
        else {
            logger.error(`failed to find valid context or object`);
            return { path, options, success: false };
        }

        if (!artifact) {
            logger.error(`failed to find artifact`);
            return { path, options, success: false };
        }

        const artifactPath = parseArtifact(artifact,options);

        if (artifactPath) {
            // Storing the artifact path to the options. 
            // Maybe bad practice..but it is a workflow attribute like in Nifi :P
            options['artifact'] = {
                'id': artifact ,
                'path': artifactPath
            };
            return { path, options, success: true };
        }
        else {
            logger.error(`artifact ${artifact} is not known here...`);
            return { path, options, success: false };
        }
    }
    catch(e) {
        logger.error(`failed to process ${path}`);
        logger.debug(e);
        return { path, options, success: false };
    }
}

module.exports = { handle };