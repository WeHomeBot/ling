// src/client.js;
import { Client } from"@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from"@modelcontextprotocol/sdk/client/stdio.js";
import type { McpServersConfig, McpServerConfig } from "../types";
import OpenAI from 'openai';

export class MCPClient {
  private clients: Record<string, Promise<Client>> = {};
  private toolNameMap: Record<string, Client> = {};

  registerServers(config: { mcpServers: McpServersConfig }) {
    for (const [name, server] of Object.entries(config.mcpServers)) {
      this.registerServer(name, server);
    }
  }

  registerServer(name: string, server: McpServerConfig) {
    this.clients[name] = createClient(name, server);
  }

  public async listTools(toolsType: 'function_call' | 'tool_call'): Promise<OpenAI.Chat.Completions.ChatCompletionTool[]> {
    const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [];
    for await (const [name, client] of Object.entries(this.clients)) {
      const _client = await client;
      const _tools =  (await _client.listTools()).tools.map((tool: any) => {
        this.toolNameMap[tool.name] = _client;
        if(toolsType === 'function_call') {
          const ret:OpenAI.Chat.Completions.ChatCompletionTool =  {
            type: "function" as const,
            function: {
              name: tool.name,
              description: tool.description,
              parameters: tool.inputSchema,
            }
          };
          return ret;
        } else {
          return tool;
        }
      });
      tools.push(..._tools);
    }
    return tools;
  }

  public async callTool(tool_name: string, tool_args: any) {
    const tool = await this.toolNameMap[tool_name];
    if(!tool) {
      console.warn(`Tool ${tool_name} not found`);
      return {
        role: 'tool',
        name: tool_name,
        content: "Tool not found",
      }
    }
    const result = await (tool).callTool({
      name: tool_name,
      arguments: tool_args
    });

    return {
      role: 'tool',
      name: tool_name,
      content: (result.content as any)[0].text,
    }
  }
}

async function createClient(name: string, server: McpServerConfig): Promise<Client> {
  const client = new Client({
    name,
    version: "1.0.0",
  });

  const transport = new StdioClientTransport({
    command: server.command,
    args: server.args,
  });

  try {
    await client.connect(transport);
    console.log(`Client ${name} connected successfully`);
  } catch (err) {
    console.error("Client connection failed:", err);
    throw err;
  }

  // 可选：添加客户端方法调用后的调试
  return client;
}
