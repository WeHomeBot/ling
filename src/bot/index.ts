import EventEmitter from 'node:events';

import { Tube } from "../tube";
import nunjucks from 'nunjucks';
import { getChatCompletions } from "../adapter/openai";
import { getChatCompletions as getCozeChatCompletions } from "../adapter/coze";

import type { ChatConfig, ChatOptions } from "../types";
import type { ChatCompletionAssistantMessageParam, ChatCompletionSystemMessageParam, ChatCompletionUserMessageParam } from "openai/resources/index";

type ChatCompletionMessageParam = ChatCompletionSystemMessageParam | ChatCompletionAssistantMessageParam | ChatCompletionUserMessageParam;

enum ChatState {
  INIT = 'init',
  CHATTING = 'chatting',
  FINISHED = 'finished',
}

export class Bot extends EventEmitter {
  private prompts: ChatCompletionSystemMessageParam[] = [];
  private history: ChatCompletionMessageParam[] = [];
  private customParams: Record<string, string> = {};
  private chatState = ChatState.INIT;

  constructor(private tube: Tube, private config: ChatConfig, private options: ChatOptions = {}) {
    super();
  }

  setJSONRoot(root: string | null) {
    this.options.response_format = { type: 'json_object', root };
  }

  setCustomParams(params: Record<string, string>) {
    this.customParams = {...params};
  }

  addPrompt(promptTpl: string, promptData: Record<string, string> = {}) {
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

  userMessage(message: string): ChatCompletionUserMessageParam {
    return { role: "user", content: message };
  }

  botMessage(message: string): ChatCompletionAssistantMessageParam {
    return { role: "assistant", content: message };
  }

  async chat(message: string) {
    this.chatState = ChatState.CHATTING;
    const messages = [...this.prompts, ...this.history, { role: "user", content: message }];
    if(this.config.model_name.startsWith('coze:')) {
      return getCozeChatCompletions(this.tube, messages, this.config, {...this.options, custom_variables: this.customParams}, 
        (content) => { // on complete
          this.chatState = ChatState.FINISHED;
          this.emit('response', content);
        }, (content) => { // on string response
          this.emit('string-response', content);
        }).then((content) => {
          this.emit('inference-done', content);
        });
    }
    return getChatCompletions(this.tube, messages, this.config, this.options, 
      (content) => { // on complete
        this.chatState = ChatState.FINISHED;
        this.emit('response', content);
      }, (content) => { // on string response
        this.emit('string-response', content);
      }).then((content) => {
        this.emit('inference-done', content);
      });
  }

  get state() {
    return this.chatState;
  }
}