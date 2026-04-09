import {
    InMemoryTaskMessageQueue,
    InMemoryTaskStore,
} from "@modelcontextprotocol/sdk/experimental/tasks";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
    setSubscriptionHandlers
} from "./subscriptions.js";
import { registerResources, registerTools } from "./tools.js";

/**
 * Server Factory
 *
 * This function initializes a `McpServer` with specific capabilities and instructions,
 * registers tools, resources, and prompts, and configures resource subscription handlers.
 *
 * @returns {ServerFactoryResponse} An object containing the server instance, and a `cleanup`
 * function for handling server-side cleanup when a session ends.
 *
 * Properties of the returned object:
 * - `server` {Object}: The initialized server instance.
 * - `cleanup` {Function}: Function to perform cleanup operations for a closing session.
 */
export const createServer = () => {
    // Create task store and message queue for task support
    const taskStore = new InMemoryTaskStore();
    const taskMessageQueue = new InMemoryTaskMessageQueue();

    let initializeTimeout = null;

    // Create the server
    const server = new McpServer(
        {
            name: "mcp-servers/everything",
            title: "Everything Reference Server",
            version: "2.0.0",
        },
        {
            capabilities: {
                tools: {
                    listChanged: true,
                },
                prompts: {
                    listChanged: true,
                },
                resources: {
                    subscribe: true,
                    listChanged: true,
                },
                logging: {},
                tasks: {
                    list: {},
                    cancel: {},
                    requests: {
                        tools: {
                            call: {},
                        },
                    },
                },
            },
            taskStore,
            taskMessageQueue,
        }
    );

    // Register the tools
    registerTools(server);

    // Register the resources
    registerResources(server);

    // Register the prompts
    // registerPrompts(server);

    // Set resource subscription handlers
    setSubscriptionHandlers(server);

    // Perform post-initialization operations
    server.server.oninitialized = async () => {
        // Register conditional tools now that client capabilities are known.
        // This finishes before the `notifications/initialized` handler finishes.
        registerConditionalTools(server);
    };

    // Return the ServerFactoryResponse
    return {
        server,
        cleanup: () => {
            // Clean up task store timers
            taskStore.cleanup();
            if (initializeTimeout) clearTimeout(initializeTimeout);
        },
    };
};