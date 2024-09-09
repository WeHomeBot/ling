import OpenAI from 'openai';
import { ChatConfig, ChatOptions } from '../types';
import { Tube } from '../../tube';
import { JSONParser } from '../../parser';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
) {
  options = {...DEFAULT_CHAT_OPTIONS, ...options};
  const {model_name, api_key, endpoint} = config;

  const isJSONFormat = options.response_format?.type === 'json_object';
  let parser: JSONParser | undefined;

  if (isJSONFormat) {
    parser = new JSONParser();
    parser.on('data', (data) => {
      tube.enqueue(data);
    });
  }

  const client = new OpenAI({
    apiKey: api_key,
    baseURL: endpoint.replace(/\/chat\/completions$/, ''),
    dangerouslyAllowBrowser: true,
  });

  const onComplete = options.onComplete;
  delete options.onComplete;

  const events = await client.chat.completions.create({
    messages,
    ...options,
    model: model_name,
    stream: true,
  });

  let content = '';
  const buffer: string[] = [];
  let done = false;

  const promises: any[] = [
    (async () => {
      for await (const event of events) {
        if (tube.canceled) break;
        const choice = event.choices[0];
        if (choice && choice.delta) {
          if (choice.delta.content) {
            content += choice.delta.content;
            buffer.push(...choice.delta.content);
          }
        }
      }
      done = true;
      if (!tube.canceled && onComplete) onComplete(content);
    })(),
    (async () => {
      let i = 0;
      while (!(done && i >= buffer.length)) {
        if (i < buffer.length) {
          if (parser) {
            parser.trace(buffer[i]);
          } else {
            tube.enqueue(buffer[i]);
          }
          i++;
        }
        const delta = buffer.length - i;
        if (done || delta <= 0) await sleep(10);
        else await sleep(Math.max(10, 1000 / delta));
      }
    })(),
  ];
  await Promise.all(promises);
}