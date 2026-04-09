import { skillRegistry } from "./registry/skill-registry.js";
import { toolRegistry } from "./registry/tool-registry.js";

export function registerTools(server) {
    for (const { name, description, inputSchema } of toolRegistry.getAllDefinitions()) {
        server.registerTool(name, { description, inputSchema }, (params) => {
            return toolRegistry.executeTool(name, params);
        });
    }
}

export function registerResources(server) {
    for (const { name, description, uri } of skillRegistry.list()) {
        server.registerResource(name, uri, { description }, async (resourceUri) => {
            const skill = skillRegistry.getByUri(resourceUri.href);
            return {
                contents: [{
                    uri: resourceUri.href,
                    mimeType: 'text/markdown',
                    text: skill.content
                }]
            };
        });
    }
}