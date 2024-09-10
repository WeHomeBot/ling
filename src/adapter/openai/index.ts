import OpenAI from 'openai';

import { AzureOpenAI } from "openai";
import "@azure/openai/types";

import { ChatConfig, ChatOptions } from '../types';
import { Tube } from '../../tube';
import { JSONParser } from '../../parser';
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
  onStringResponse?: (content: {uri: string|null, delta: string}) => void,
) {
  options = {...DEFAULT_CHAT_OPTIONS, ...options};
  options.max_tokens = options.max_tokens || config.max_tokens || 4096; // || 16384;
  const isJSONFormat = options.response_format?.type === 'json_object';

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

  const events = await client.chat.completions.create({
    messages,
    ...options,
    model,
    stream: true,
  });

  let content = '';
  const buffer: string[] = [];
  let done = false;

  let parser: JSONParser | undefined;

  if (isJSONFormat) {
    const parentPath = options.response_format?.root;
    parser = new JSONParser({
      parentPath,
    });
    parser.on('data', (data) => {
      buffer.push(data);
    });
    parser.on('string-resolve', (content) => {
      if (onStringResponse) onStringResponse(content);
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
            if (parser) {
              parser.trace(choice.delta.content);
            } else {
              buffer.push(...choice.delta.content);
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
    })(),
    (async () => {
      let i = 0;
      while (!(done && i >= buffer.length)) {
        if (i < buffer.length) {
          tube.enqueue(buffer[i]);
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
  if (!isJSONFormat && onStringResponse) onStringResponse({uri: null, delta: content});
  return content;
}