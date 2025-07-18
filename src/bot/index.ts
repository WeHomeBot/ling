import EventEmitter from 'node:events';

import { Tube } from '../tube';
import nunjucks from 'nunjucks';
import { getChatCompletions } from '../adapter/openai';
import { getChatCompletions as getCozeChatCompletions } from '../adapter/coze';
import { getChatCompletions as getOllamaChatCompletions } from '../adapter/ollama';

import type { ChatConfig, ChatOptions } from '../types';
import type {
  ChatCompletionAssistantMessageParam,
  ChatCompletionSystemMessageParam,
  ChatCompletionUserMessageParam,
  ChatCompletionContentPart,
} from 'openai/resources/chat/completions';

import { shortId } from '../utils';
import { MCPClient } from '../mcp/client';

type ChatCompletionMessageParam =
  | ChatCompletionSystemMessageParam
  | ChatCompletionAssistantMessageParam
  | ChatCompletionUserMessageParam;

interface FilterMap {
  [key: string]: boolean;
}

export enum WorkState {
  INIT = 'init',
  WORKING = 'chatting',
  INFERENCE_DONE = 'inference-done',
  FINISHED = 'finished',
  ERROR = 'error',
}

export abstract class Bot extends EventEmitter {
  abstract get state(): WorkState;
}

export class ChatBot extends Bot {
  private prompts: ChatCompletionSystemMessageParam[] = [];
  private history: ChatCompletionMessageParam[] = [];
  private customParams: Record<string, string> = {};
  private chatState = WorkState.INIT;
  private config: ChatConfig;
  private options: ChatOptions;
  private id: string;
  private _mcpClient: MCPClient | undefined;

  constructor(
    private tube: Tube,
    config: ChatConfig,
    options: ChatOptions = {}
  ) {
    super();
    this.id = shortId();
    this.config = { ...config };
    this.options = { ...options, bot_id: this.id };
  }

  setMCPClient(client: MCPClient) {
    this._mcpClient = client;
  }

  isJSONFormat() {
    return this.options.response_format?.type === 'json_object';
  }

  get root() {
    return this.options.response_format?.root;
  }

  setJSONRoot(root: string | null) {
    if (!this.options.response_format) {
      this.options.response_format = { type: 'json_object', root };
    } else {
      this.options.response_format.root = root;
    }
  }

  setCustomParams(params: Record<string, string>) {
    this.customParams = { ...params };
  }

  addPrompt(promptTpl: string, promptData: Record<string, any> = {}) {
    const promptText = nunjucks.renderString(promptTpl, {
      chatConfig: this.config,
      chatOptions: this.options,
      ...this.customParams,
      ...promptData,
    });
    this.prompts.push({ role: 'system', content: promptText });
  }

  setPrompt(promptTpl: string, promptData: Record<string, string> = {}) {
    this.prompts = [];
    this.addPrompt(promptTpl, promptData);
  }

  addHistory(messages: ChatCompletionMessageParam[]) {
    this.history.push(...messages);
  }

  setHistory(messages: ChatCompletionMessageParam[]) {
    this.history = messages;
  }

  addFilter(filter: ((data: any) => boolean) | string | RegExp | FilterMap) {
    if (typeof filter === 'string') {
      // 如果是 string，则排除掉该字段
      this.tube.addFilter(this.id, (data: any) => data.uri === `${this.root}/${filter}`);
    } else if (filter instanceof RegExp) {
      // 如果是正则表达式，则过滤掉匹配该正则表达式的字段
      this.tube.addFilter(this.id, (data: any) => filter.test(data.uri));
    } else if (typeof filter === 'function') {
      // 如果是函数，那么应当过滤掉函数返回值为false的数据，保留返回为true的
      this.tube.addFilter(this.id, (data: any) => !filter(data));
    } else if (typeof filter === 'object') {
      // 如果是对象，那么应当过滤掉对象中值为false的键，或者保留为true的键
      const _filter = filter as FilterMap;
      const filterFun = ({ uri }: any) => {
        if (uri == null) return false;
        let isTrueFilter = false;
        for (const key in _filter) {
          if (uri === `${this.root}/${key}`) {
            return !_filter[key];
          }
          if (_filter[key] && !isTrueFilter) {
            isTrueFilter = true;
          }
        }
        return isTrueFilter;
      };
      this.tube.addFilter(this.id, filterFun);
    }
  }

  clearFilters() {
    this.tube.clearFilters(this.id);
  }

  userMessage(message: string): ChatCompletionUserMessageParam {
    return { role: 'user', content: message };
  }

  botMessage(message: string): ChatCompletionAssistantMessageParam {
    return { role: 'assistant', content: message };
  }

  async chat(message: string | ChatCompletionContentPart[]) {
    try {
      this.chatState = WorkState.WORKING;
      const isJSONFormat = this.isJSONFormat();
      const prompts = this.prompts.length > 0 ? [...this.prompts] : [];
      if (this.prompts.length === 0 && isJSONFormat) {
        prompts.push({
          role: 'system',
          content: `[Output]\nOutput with json format, starts with '{'\n[Example]\n{"answer": "My answer"}`,
        });
      }
      const messages = [...prompts, ...this.history, { role: 'user', content: message }];
      if (this.config.endpoint.startsWith('https://api.coze.cn')) {
        return getCozeChatCompletions(
          this.tube,
          messages,
          this.config,
          { ...this.options, custom_variables: this.customParams },
          content => {
            // on complete
            this.chatState = WorkState.FINISHED;
            this.emit('response', content);
          },
          content => {
            // on string response
            this.emit('string-response', content);
          },
          content => {
            // on object response
            this.emit('object-response', content);
          }
        ).then(content => {
          // on inference done
          this.chatState = WorkState.INFERENCE_DONE;
          this.emit('inference-done', content);
        });
      }
      if (this.config.endpoint === 'ollama') {
        return getOllamaChatCompletions(
          this.tube,
          messages,
          this.config,
          this.options,
          this._mcpClient,
          content => {
            // on complete
            this.chatState = WorkState.FINISHED;
            this.emit('response', content);
          },
          content => {
            // on string response
            this.emit('string-response', content);
          },
          content => {
            // on object response
            this.emit('object-response', content);
          }
        ).then(content => {
          // on inference done
          this.chatState = WorkState.INFERENCE_DONE;
          this.emit('inference-done', content);
        });
      }
      return getChatCompletions(
        this.tube,
        messages,
        this.config,
        this.options,
        this._mcpClient,
        content => {
          // on complete
          this.chatState = WorkState.FINISHED;
          this.emit('response', content);
        },
        content => {
          // on string response
          this.emit('string-response', content);
        },
        content => {
          // on object response
          this.emit('object-response', content);
        }
      ).then(content => {
        // on inference done
        this.chatState = WorkState.INFERENCE_DONE;
        this.emit('inference-done', content);
      });
    } catch (ex: any) {
      console.error(ex);
      this.chatState = WorkState.ERROR;
      // 不主动发error给客户端
      // this.tube.enqueue({event: 'error', data: ex.message});
      this.emit('error', ex.message);
      // this.tube.cancel();
    }
  }

  finish() {
    this.emit('inference-done', 'null');
    this.emit('response', 'null');
    this.chatState = WorkState.FINISHED;
  }

  get state() {
    return this.chatState;
  }
}
