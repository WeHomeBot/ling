import ollama from 'ollama';
import OpenAI from 'openai';
import path from 'node:path';
import type { ChatConfig, ChatOptions } from '../../types';
import type { Tube } from '../../tube';
import { JSONParser, HTMLParser, HTMLParserEvents } from '../../parser';
import { MCPClient } from '../../mcp/client';

export async function getChatCompletions(
  tube: Tube,
  messages: any[],
  config: ChatConfig,
  options?: ChatOptions,
  mcpClient?: MCPClient,
  onComplete?: (content: string) => void,
  onStringResponse?: (content: any) => void,
  onObjectResponse?: (content: any) => void
) {
  options = { ...options };
  const { model_name } = config;

  const isQuiet: boolean = !!options.quiet;
  const bot_id = options.bot_id;
  delete options.quiet;
  delete options.bot_id;

  const isJSONFormat = options.response_format?.type === 'json_object';
  const isHTMLFormat = options.response_format?.type === 'html';

  const format = options.response_format?.type === 'json_object' ? 'json' : 'text';
  const parentPath = options.response_format?.root;

  if (isHTMLFormat) {
    options.response_format = { type: 'text' };
  }

  let parser: JSONParser | HTMLParser | undefined;

  if (isJSONFormat) {
    parser = new JSONParser({
      parentPath,
      autoFix: true,
    });
    parser.on('data', data => {
      tube.enqueue(data, isQuiet, bot_id);
    });
    parser.on('string-resolve', content => {
      if (onStringResponse) onStringResponse(content);
    });
    parser.on('object-resolve', content => {
      if (onObjectResponse) onObjectResponse(content);
    });
  } else if (isHTMLFormat) {
    if (parentPath) throw new Error("Don't support parent path in HTML Format");
    parser = new HTMLParser();
    parser.on(HTMLParserEvents.OPEN_TAG, (path, name, attributes) => {
      tube.enqueue({ path, type: 'open_tag', name, attributes }, isQuiet, bot_id);
    });
    parser.on(HTMLParserEvents.CLOSE_TAG, (path, name) => {
      tube.enqueue({ path, type: 'close_tag', name }, isQuiet, bot_id);
      if (onObjectResponse) onObjectResponse({ path, name });
    });
    parser.on(HTMLParserEvents.TEXT_DELTA, (path, text) => {
      tube.enqueue({ path, type: 'text_delta', delta: text }, isQuiet, bot_id);
    });
    parser.on(HTMLParserEvents.TEXT, (path, text) => {
      if (path.endsWith('script') || path.endsWith('style')) {
        tube.enqueue({ path, type: 'text_delta', delta: text }, isQuiet, bot_id);
      }
      if (onStringResponse) onStringResponse({ path, text });
    });
  }

  let tools: OpenAI.Chat.Completions.ChatCompletionTool[];
  let toolIndex = 0;
  if (mcpClient) {
    tools = await mcpClient.listTools(options.tool_type || 'function_call');
  }
  let content = '';

  const proceed = async (messages: any[]): Promise<void> => {
    const response = await ollama.chat({
      model: model_name,
      messages,
      stream: true,
      think: true,
      // format,
      tools: tools.length > 0 ? tools : undefined,
    });

    // console.log({
    //   model: model_name,
    //   messages,
    //   stream: true,
    //   think: true,
    //   // format,
    //   tools: tools.length > 0 ? tools : undefined,
    // });

    const toolResults: { role: 'tool'; name: string; content: string }[] = [];

    for await (const part of response) {
      const message = part.message;
      // console.log(message);
      if (message.thinking) {
        // 思考
        tube.enqueue({
          uri: path.join(parentPath || '', '$reasoning_context'),
          delta: message.thinking,
        });
      }
      if (message.content) {
        // 内容
        content += message.content;
        if (parser) {
          // JSON format
          parser.trace(message.content);
          if (isJSONFormat && (parser as JSONParser).isBeforeStart()) {
            tube.enqueue({
              uri: path.join(parentPath || '', '$reasoning_context'),
              delta: message.content,
            });
          }
        } else {
          tube.enqueue({ uri: parentPath, delta: message.content });
        }
      }
      if (message.tool_calls) {
        const toolTask = [];
        for (const toolCall of message.tool_calls) {
          if (toolCall.function?.name) {
            tube.enqueue({
              url: path.join(parentPath || '', '$tools', toolIndex.toString()),
              delta: JSON.stringify(toolCall.function),
              // delta: `⚒️ (do task) -> ${toolCall.function.name} | ${toolCall.function.arguments.replace(/\n/g, ' ')}\n\n`
            });
            const index = toolIndex++;
            toolTask.push(
              mcpClient!
                .callTool(toolCall.function.name, toolCall.function.arguments || {})
                .then(res => {
                  tube.enqueue({
                    url: path.join(parentPath || '', '$tool_results', index.toString()),
                    delta: JSON.stringify(res),
                  });
                  toolResults.push({
                    role: 'tool',
                    name: toolCall.function.name,
                    content: JSON.stringify(res),
                  });
                })
            );
          }
        }
        await Promise.all(toolTask);
        if (toolResults.length) {
          return await proceed([...messages, ...toolResults]);
        }
      }
    }
  };

  await proceed(messages);
  if (!isJSONFormat && onStringResponse) onStringResponse({ uri: parentPath, delta: content });
  return content; // inference done
}
