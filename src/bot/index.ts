import EventEmitter from 'node:events';

import { Tube } from "../tube";
import nunjucks from 'nunjucks';
import { getChatCompletions } from "../adapter/openai";
import { getChatCompletions as getCozeChatCompletions } from "../adapter/coze";

import type { ChatConfig, ChatOptions } from "../types";
import type { ChatCompletionAssistantMessageParam, ChatCompletionSystemMessageParam, ChatCompletionUserMessageParam } from "openai/resources/index";

type ChatCompletionMessageParam = ChatCompletionSystemMessageParam | ChatCompletionAssistantMessageParam | ChatCompletionUserMessageParam;

export enum WorkState {
  INIT = 'init',
  WORKING = 'chatting',
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

  constructor(private tube: Tube, config: ChatConfig, options: ChatOptions = {}) {
    super();
    this.config = { ...config };
    this.options = { ...options };
  }

  setJSONRoot(root: string | null) {
    if(!this.options.response_format) {
      this.options.response_format = { type: 'json_object', root };
    } else {
      this.options.response_format.root = root;
    }
  }

  setCustomParams(params: Record<string, string>) {
    this.customParams = {...params};
  }

  addPrompt(promptTpl: string, promptData: Record<string, any> = {}) {
    const promptText = nunjucks.renderString(promptTpl, { chatConfig: this.config, chatOptions: this.options, ...this.customParams, ...promptData, });
    this.prompts.push({ role: "system", content: promptText });
  }

  setPrompt(promptTpl: string, promptData: Record<string, string> = {}) {
    this.prompts = [];
    this.addPrompt(promptTpl, promptData);
  }

  addHistory(messages: ChatCompletionMessageParam []) {
    this.history.push(...messages);
  }

  setHistory(messages: ChatCompletionMessageParam []) {
    this.history = messages;
  }

  addFilter(filter: ((data: unknown) => boolean) | string | RegExp) {
    this.tube.addFilter(filter);
  }

  clearFilters() {
    this.tube.clearFilters();
  }

  userMessage(message: string): ChatCompletionUserMessageParam {
    return { role: "user", content: message };
  }

  botMessage(message: string): ChatCompletionAssistantMessageParam {
    return { role: "assistant", content: message };
  }

  async chat(message: string) {
    try {
      this.chatState = WorkState.WORKING;
      const isJSONFormat = this.options.response_format?.type === 'json_object';
      const prompts = this.prompts.length > 0 ? [...this.prompts] : [];
      if(this.prompts.length === 0 && isJSONFormat) {
        prompts.push({
          role: 'system',
          content: `[Output]\nOutput with json format, starts with '{'\n[Example]\n{"answer": "My answer"}`,
        });
      }
      const messages = [...prompts, ...this.history, { role: "user", content: message }];
      if(this.config.model_name.startsWith('coze:')) {
        return await getCozeChatCompletions(this.tube, messages, this.config, {...this.options, custom_variables: this.customParams}, 
          (content) => { // on complete
            this.chatState = WorkState.FINISHED;
            this.emit('response', content);
          }, (content) => { // on string response
            this.emit('string-response', content);
          }).then((content) => {
            this.emit('inference-done', content);
          });
      }
      return await getChatCompletions(this.tube, messages, this.config, this.options, 
        (content) => { // on complete
          this.chatState = WorkState.FINISHED;
          this.emit('response', content);
        }, (content) => { // on string response
          this.emit('string-response', content);
        }).then((content) => {
          this.emit('inference-done', content);
        });
    } catch(ex: any) {
      console.error(ex);
      this.chatState = WorkState.ERROR;
      this.tube.enqueue({event: 'error', data: ex.message});
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