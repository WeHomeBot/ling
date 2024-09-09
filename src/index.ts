import { Bot } from './bot/index';
import { Tube } from './tube';
import type { ChatConfig, ChatOptions } from "./adapter/types";

export class Ling {
  private tube: Tube;
  private customParams: Record<string, string> = {};

  constructor(private config: ChatConfig, private options: ChatOptions = {}) {
    this.tube = new Tube();
  }

  createBot(root: string) {
    const bot = new Bot(this.tube, this.config, this.options);
    bot.setJSONRoot(root);
    bot.addCustomParams(this.customParams);
    return bot;
  }

  addCustomParams(params: Record<string, string>) {
    this.customParams = {...params};
  }

  close() {
    this.tube.close();
  }

  cancel() {
    this.tube.cancel();
  }

  get stream() {
    return this.tube.stream;
  }

  get canceled() {
    return this.tube.canceled;
  }
}

export { Bot };
