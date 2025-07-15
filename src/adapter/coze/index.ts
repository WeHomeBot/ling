import { ChatConfig, ChatOptions } from '../../types';
import { Tube } from '../../tube';
import { JSONParser, HTMLParser, HTMLParserEvents } from '../../parser';
import { sleep } from '../../utils';

export async function getChatCompletions(
  tube: Tube,
  messages: any[],
  config: ChatConfig,
  options?: ChatOptions & { custom_variables?: Record<string, string> },
  onComplete?: (content: string, function_calls?: any[]) => void,
  onStringResponse?: (content: any) => void,
  onObjectResponse?: (content: any) => void
) {
  const cozeBotId = config.model_name.replace(/^coze:/, '');
  const { api_key, endpoint } = config as ChatConfig;

  const isQuiet: boolean = !!options?.quiet;
  const bot_id = options?.bot_id;
  delete options?.quiet;
  delete options?.bot_id;

  const isJSONFormat = options?.response_format?.type === 'json_object';
  const isHTMLFormat = options?.response_format?.type === 'html';

  // system
  let system = '';
  const systemPrompts = messages.filter(message => message.role === 'system');
  if (systemPrompts.length > 0) {
    system = systemPrompts.map(message => message.content).join('\n\n');
    messages = messages.filter(message => message.role !== system);
  }

  const custom_variables = { systemPrompt: system, ...options?.custom_variables };
  const query = messages.pop();

  const chat_history = messages.map(message => {
    if (message.role === 'function') {
      return {
        role: 'assistant',
        type: 'tool_response',
        content: message.content,
        content_type: 'text',
      };
    } else if (message.role === 'assistant' && message.function_call) {
      return {
        role: 'assistant',
        type: 'function_call',
        content: JSON.stringify(message.function_call),
        content_type: 'text',
      };
    } else if (message.role === 'assistant') {
      return {
        role: 'assistant',
        type: 'answer',
        content: message.content,
        content_type: 'text',
      };
    }
    return {
      role: message.role,
      content: message.content,
      content_type: 'text',
    };
  });

  let parser: JSONParser | HTMLParser | undefined;
  const parentPath = options?.response_format?.root;

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

  const _payload = {
    bot_id: cozeBotId,
    user: 'bearbobo',
    query: query.content,
    chat_history,
    stream: true,
    custom_variables,
  } as any;

  const body = JSON.stringify(_payload, null, 2);

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${api_key}`,
    },
    body,
  });

  const reader = res.body?.getReader();
  if (!reader) {
    console.error('No reader');
    tube.cancel();
    return;
  }

  let content = '';
  const enc = new TextDecoder('utf-8');
  let buffer = '';
  let functionCalling = false;
  const function_calls = [];
  let funcName = '';

  do {
    if (tube.canceled) break;
    const { done, value } = await reader.read();
    if (done) break;
    const delta = enc.decode(value);
    const events = delta.split('\n\n');
    for (const event of events) {
      // console.log('event', event);
      if (/^\s*data:/.test(event)) {
        buffer += event.replace(/^\s*data:\s*/, '');
        let data;
        try {
          data = JSON.parse(buffer);
        } catch (ex) {
          console.error(ex, buffer);
          continue;
        }
        buffer = '';
        if (data.error_information) {
          // console.error(data.error_information.err_msg);
          tube.enqueue({ event: 'error', data }, isQuiet, bot_id);
          tube.cancel();
          break;
        }
        const message = data.message;
        if (message) {
          if (message.type === 'answer') {
            let result = message.content;
            if (!content) {
              // 去掉开头的空格，coze有时候会出现这种情况，会影响 markdown 格式
              result = result.trimStart();
              if (!result) continue;
            }
            content += result;
            const chars = [...result];
            for (let i = 0; i < chars.length; i++) {
              if (parser) {
                parser.trace(chars[i]);
              } else {
                tube.enqueue({ uri: parentPath, delta: chars[i] }, isQuiet, bot_id);
              }
              await sleep(50);
            }
            if (functionCalling) {
              // function_call 偶尔未返回结果，原因未知
              tube.enqueue({ event: 'tool_response', data: null }, isQuiet, bot_id);
              functionCalling = false;
            }
          } else if (message.type === 'function_call') {
            functionCalling = true;
            const func = JSON.parse(message.content);
            func.arguments = JSON.stringify(func.arguments);
            function_calls.push({
              role: 'assistant',
              content,
              function_call: func,
            });
            funcName = func.name;
            tube.enqueue({ event: 'function_call', data: func }, isQuiet, bot_id);
          } else if (message.type === 'tool_response') {
            functionCalling = false;
            function_calls.push({
              role: 'function',
              name: funcName,
              content: message.content,
            });
            tube.enqueue({ event: 'tool_response', data: message.content }, isQuiet, bot_id);
          }
        }
      } else {
        try {
          const data = JSON.parse(event);
          if (data.code) {
            tube.enqueue({ event: 'error', data }, isQuiet, bot_id);
            tube.cancel();
          }
        } catch (ex) {
          /* empty */
        }
      }
    }
    // eslint-disable-next-line no-constant-condition
  } while (1);
  if (!isJSONFormat && onStringResponse) onStringResponse({ uri: parentPath, delta: content });
  if (!tube.canceled && onComplete) onComplete(content, function_calls);
  return content;
}
