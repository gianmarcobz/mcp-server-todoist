import express from "express";
import cors from "cors";
import { randomUUID } from "crypto";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { ListPromptsRequestSchema, GetPromptRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { setupHandlers } from './handlers/mcpHandlers.js';
import { getTodoistClient } from './utils/todoistClient.js';
import { logger } from './utils/logger.js';

// Initialize Todoist client once
const args = process.argv.slice(2);
let apiToken: string | undefined;
for (let i = 0; i < args.length; i++) {
  if ((args[i] === '--token' || args[i] === '-t') && i + 1 < args.length) {
    apiToken = args[i + 1];
    break;
  }
}
const todoistClient = getTodoistClient(apiToken);
console.error("TODOIST_INIT: client=" + (todoistClient ? "OK" : "NULL") + " token=" + (process.env.TODOIST_API_TOKEN ? process.env.TODOIST_API_TOKEN.substring(0,8) + "..." : "MISSING"));

function createServer(): Server {
  const server = new Server(
    { name: "todoist-server", version: "0.1.0" },
    { capabilities: { resources: {}, tools: {}, prompts: {} } as any }
  );
  setupHandlers(server);
  server.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: [{ name: "todoist_overview", description: "Genera un riepilogo dello stato di Todoist" }]
  }));
  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    if (request.params.name !== "todoist_overview") throw new Error("Prompt sconosciuto");
    return { messages: [{ role: "user", content: { type: "text", text: "Genera un riepilogo dello stato attuale di Todoist." } }] };
  });
  return server;
}

const app = express();
app.use(express.json());
app.use(cors({
  origin: '*',
  exposedHeaders: ['Mcp-Session-Id'],
  allowedHeaders: ['Content-Type', 'mcp-session-id'],
}));

const sessions: { [sessionId: string]: { transport: StreamableHTTPServerTransport; server: Server } } = {};

app.post('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (sessionId && sessions[sessionId]) {
    await sessions[sessionId].transport.handleRequest(req, res, req.body);
  } else {
    const server = createServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sid) => { sessions[sid] = { transport, server }; },
      enableDnsRebindingProtection: false,
    });
    transport.onclose = () => {
      if (transport.sessionId) delete sessions[transport.sessionId];
    };
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  }
});

const handleSessionRequest = async (req: express.Request, res: express.Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  if (!sessionId || !sessions[sessionId]) {
    res.status(400).send('Invalid or missing session ID');
    return;
  }
  await sessions[sessionId].transport.handleRequest(req, res);
};

app.get('/mcp', handleSessionRequest);
app.delete('/mcp', handleSessionRequest);

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.error(`MCP server listening on port ${PORT}`);
}); 