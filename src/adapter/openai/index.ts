import OpenAI from 'openai';

import { AzureOpenAI } from "openai";
import "@azure/openai/types";

import { ChatConfig, ChatOptions } from '../../types';
import { Tube } from '../../tube';
import { JSONParser, HTMLParser, HTMLParserEvents } from '../../parser';
import { sleep } from '../../utils';

import "dotenv/config";

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

  const events = await client.chat.completions.create({
    messages,
    ...options,
    model,
    stream: true,
  });

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
    parser = new HTMLParser({
      parentPath,
    });
    parser.on(HTMLParserEvents.OPEN_TAG, (xpath, name, attributes) => {
      tube.enqueue({ xpath, type:'open_tag', name, attributes }, isQuiet, bot_id);
    });
    parser.on(HTMLParserEvents.CLOSE_TAG, (xpath, name) => {
      tube.enqueue({ xpath, type:'close_tag', name }, isQuiet, bot_id);
      if (onObjectResponse) onObjectResponse({xpath, name});
    });
    parser.on(HTMLParserEvents.TEXT_DELTA, (xpath, text) => {
      tube.enqueue({ xpath, type:'text_delta', delta: text }, isQuiet, bot_id);
    });
    parser.on(HTMLParserEvents.TEXT, (xpath, text) => {
      if(xpath.endsWith('script') || xpath.endsWith('style')) {
        tube.enqueue({ xpath, type:'text_delta', delta: text }, isQuiet, bot_id);
      }
      if (onStringResponse) onStringResponse({xpath, text});
    });
  }

  const promises: any[] = [
    (async () => {
      for await (const event of events) {
        if (tube.canceled) break;
        const choice = event.choices[0];
        if (choice && choice.delta) {
          if (choice.delta.content) {
            content += choice.delta.content;
            if (parser) { // JSON format
              parser.trace(choice.delta.content);
            } else {
              buffer.push({ uri: parentPath, delta: choice.delta.content });
            }
          }
          // const filterResults = choice.content_filter_results;
          // if (!filterResults) {
          //   continue;
          // }
          // if (filterResults.error) {
          //   console.log(
          //     `\tContent filter ran into an error ${filterResults.error.code}: ${filterResults.error.message}`,
          //   );
          // } else {
          //   const { hate, sexual, selfHarm, violence } = filterResults;
          //   console.log(
          //     `\tHate category is filtered: ${hate?.filtered}, with ${hate?.severity} severity`,
          //   );
          //   console.log(
          //     `\tSexual category is filtered: ${sexual?.filtered}, with ${sexual?.severity} severity`,
          //   );
          //   console.log(
          //     `\tSelf-harm category is filtered: ${selfHarm?.filtered}, with ${selfHarm?.severity} severity`,
          //   );
          //   console.log(
          //     `\tViolence category is filtered: ${violence?.filtered}, with ${violence?.severity} severity`,
          //   );
          // }
        }
      }
      done = true;
      // if (parser) {
      //   parser.finish();
      // }
    })(),
    (async () => {
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
    })(),
  ];
  await Promise.race(promises);
  if (!isJSONFormat && onStringResponse) onStringResponse({ uri: parentPath, delta: content });
  return content; // inference done
}