import path from 'node:path';
import OpenAI from 'openai';

import { AzureOpenAI } from "openai";
import "@azure/openai/types";

import { ChatConfig, ChatOptions } from '../../types';
import { Tube } from '../../tube';
import { JSONParser, HTMLParser, HTMLParserEvents } from '../../parser';
import { sleep } from '../../utils';

import "dotenv/config";
import { MCPClient } from '../../mcp/client';

const DEFAULT_CHAT_OPTIONS = {
  temperature: 0.9,
  top_p: 1,
  frequency_penalty: 0,
  presence_penalty: 0,
};

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
  options = {...DEFAULT_CHAT_OPTIONS, ...options};
  if (options.response_format) { // 防止原始引用对象里的值被删除
    options.response_format = {type: options.response_format.type, root: options.response_format.root};
  }
  options.max_tokens = options.max_tokens || config.max_tokens || 4096; // || 16384;

  const isQuiet: boolean = !!options.quiet;
  const bot_id = options.bot_id;
  delete options.quiet;
  delete options.bot_id;

  const isJSONFormat = options.response_format?.type === 'json_object';
  const isHTMLFormat = options.response_format?.type === 'html';

  let client: OpenAI | AzureOpenAI;
  let model = '';
  if(config.endpoint.endsWith('openai.azure.com')) {
    process.env.AZURE_OPENAI_ENDPOINT=config.endpoint;
    const scope = "https://cognitiveservices.azure.com/.default";
    const deployment = config.model_name;
    const apiVersion = config.api_version || "2024-07-01-preview";
    client = new AzureOpenAI({ 
      endpoint: config.endpoint, 
      apiKey: config.api_key, 
      // azureADTokenProvider,
      apiVersion,
      deployment });
  } else {
    const {model_name, api_key, endpoint} = config as ChatConfig;
    model = model_name;
    client = new OpenAI({
      apiKey: api_key,
      baseURL: endpoint.replace(/\/chat\/completions$/, ''),
      dangerouslyAllowBrowser: true,
    });
  }

  const parentPath = options.response_format?.root;
  delete options.response_format.root;
  if(isHTMLFormat) {
    options.response_format = {type: 'text'};
  }

  let content = '';
  const buffer: any[] = [];
  let done = false;

  let parser: JSONParser | HTMLParser | undefined;
  
  if (isJSONFormat) {
    parser = new JSONParser({
      parentPath,
      autoFix: true,
    });
    parser.on('data', (data) => {
      buffer.push(data);
    });
    parser.on('string-resolve', (content) => {
      if (onStringResponse) onStringResponse(content);
    });
    parser.on('object-resolve', (content) => {
      if (onObjectResponse) onObjectResponse(content);
    });
  } else if(isHTMLFormat) {
    if(parentPath) throw new Error('Don\'t support parent path in HTML Format');
    parser = new HTMLParser();
    parser.on(HTMLParserEvents.OPEN_TAG, (path, name, attributes) => {
      tube.enqueue({ path, type:'open_tag', name, attributes }, isQuiet, bot_id);
    });
    parser.on(HTMLParserEvents.CLOSE_TAG, (path, name) => {
      tube.enqueue({ path, type:'close_tag', name }, isQuiet, bot_id);
      if (onObjectResponse) onObjectResponse({path, name});
    });
    parser.on(HTMLParserEvents.TEXT_DELTA, (path, text) => {
      tube.enqueue({ path, type:'text_delta', delta: text }, isQuiet, bot_id);
    });
    parser.on(HTMLParserEvents.TEXT, (path, text) => {
      if(path.endsWith('script') || path.endsWith('style')) {
        tube.enqueue({ path, type:'text_delta', delta: text }, isQuiet, bot_id);
      }
      if (onStringResponse) onStringResponse({path, text});
    });
  }

  let tools: OpenAI.Chat.Completions.ChatCompletionTool[];
  let toolIndex = 0;
  if(mcpClient) {
    tools = await mcpClient.listTools(options.tool_type || 'function_call');
  }

  const proceed = async(messages: any[]) => {
    const events = await client.chat.completions.create({
      messages,
      ...options,
      tools: tools.length > 0 ? tools : undefined,
      model,
      stream: true,
    });
    let hasToolCall = false;
    let toolCalls: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[] = [];

    for await (const event of events) {
      if (tube.canceled) break;
      const choice = event.choices[0];
      // console.log(JSON.stringify(choice));
      if (choice && choice.delta) {
        const delta = choice.delta;
        if (delta.content) {
          content += delta.content;
          if (parser) { // JSON format
            parser.trace(delta.content);
            if(isJSONFormat && (parser as JSONParser).isBeforeStart()) {
              buffer.push({ uri: path.join(parentPath || '', '$reasoning_context'), delta: delta.content });
            }
          } else {
            buffer.push({ uri: parentPath, delta: delta.content });
          }
        }
        // Note: reasoning property removed in OpenAI v5
        if ((delta as any).reasoning) {
          buffer.push({ uri: path.join(parentPath || '', '$reasoning_context'), delta: (delta as any).reasoning });
        }
        if (delta.tool_calls) {
          hasToolCall = true;
          for (const toolCall of delta.tool_calls) {
            if (toolCall.index !== undefined) {
              if (!toolCalls[toolCall.index]) {
                toolCalls[toolCall.index] = {
                  id: toolCall.id || '',
                  type: 'function',
                  function: { name: '', arguments: '' }
                };
              }
              
              if (toolCall.function?.name) {
                // join function name
                toolCalls[toolCall.index].function.name += toolCall.function.name;
              }
              if (toolCall.function?.arguments) {
                // join arguments
                toolCalls[toolCall.index].function.arguments += toolCall.function.arguments;
              }
            }
          }
        }
      }
    }

    if (hasToolCall && toolCalls.length > 0) {
      const toolResults = await Promise.all(
        toolCalls.map(async (toolCall) => {
          // console.log(JSON.stringify(toolCall));
          buffer.push({
            url: path.join(parentPath || '', '$tools', (toolIndex++).toString()), 
            delta: JSON.stringify(toolCall.function),
            // delta: `⚒️ (do task) -> ${toolCall.function.name} | ${toolCall.function.arguments.replace(/\n/g, ' ')}\n\n`
          });
          try {
            const result = await mcpClient!.callTool(
              toolCall.function.name,
              JSON.parse(toolCall.function.arguments || '{}')
            );
            return {
              role: 'tool' as const,
              tool_call_id: toolCall.id,
              content: result.content,
            };
          } catch(ex: any) {
            console.error(ex);
            return {
              role: 'tool' as const,
              tool_call_id: toolCall.id,
              content: 'Error: ' + ex.message,
            }
          }
        })
      );

      // Continue with tool results
      const assistantMessage: OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam = {
        role: 'assistant',
        content: content || null,
        tool_calls: toolCalls,
      };

      return await proceed([
        ...messages,
        assistantMessage,
        ...toolResults
      ]);
    }

    done = true;
    // if (parser) {
    //   parser.finish();
    // }
  };

  const promises: any[] = [
    proceed(messages)
  ];

  promises.push((async () => {
    let i = 0;
    while (!(done && i >= buffer.length)) {
      if (i < buffer.length) {
        tube.enqueue(buffer[i], isQuiet, bot_id);
        i++;
      }
      const delta = buffer.length - i;
      if (done || delta <= 0) await sleep(10);
      else await sleep(Math.max(10, 1000 / delta));
    }
    if (!tube.canceled && onComplete) onComplete(content);
  })());

  await Promise.race(promises);
  if (!isJSONFormat && onStringResponse) onStringResponse({ uri: parentPath, delta: content });
  return content; // inference done
}