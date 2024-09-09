import { Tube } from "../tube";
import nunjucks from 'nunjucks';
import { getChatCompletions } from "../adapter/openai";

import type { ChatConfig, ChatOptions } from "../adapter/types";
import type { ChatCompletionAssistantMessageParam, ChatCompletionSystemMessageParam, ChatCompletionUserMessageParam } from "openai/resources/index";

type ChatCompletionMessageParam = ChatCompletionSystemMessageParam | ChatCompletionAssistantMessageParam | ChatCompletionUserMessageParam;

export class Bot {
  private prompts: ChatCompletionSystemMessageParam[] = [];
  private history: ChatCompletionMessageParam[] = [];
  private customParams: Record<string, string> = {};

  constructor(private tube: Tube, private config: ChatConfig, private options: ChatOptions = {}) {}

  setJSONRoot(root: string) {
    this.options.response_format = { type: 'json_object', root };
  }

  addCustomParams(params: Record<string, string>) {
    this.customParams = {...params};
  }

  addPrompt(promptTpl: string, promptData: Record<string, string> = {}) {
    const promptText = nunjucks.renderString(promptTpl, { chatConfig: this.config, chatOptions: this.options, ...promptData, ...this.customParams });
    this.prompts.push({ role: "system", content: promptText });
  }

  addHistory(messages: ChatCompletionMessageParam []) {
    this.history.push(...messages);
  }

  async chat(message: string) {
    const messages = [...this.prompts, ...this.history, { role: "user", content: message }];
    return getChatCompletions(this.tube, messages, this.config, this.options);
  }
}