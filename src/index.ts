import EventEmitter from 'node:events';

import { Bot } from './bot/index';
import { Tube } from './tube';
import type { ChatConfig, ChatOptions } from "./types";
import { sleep, shortId } from './utils';

export class Ling extends EventEmitter {
  private tube: Tube;
  private customParams: Record<string, string> = {};
  private bots: Bot[] = [];

  constructor(private config: ChatConfig, private options: ChatOptions = {}) {
    super();
    this.tube = new Tube();
  }

  createBot(root: string | null = null, config: Partial<ChatConfig> = {}, options: Partial<ChatOptions> = {}) {
    const bot = new Bot(this.tube, {...this.config, ...config}, {...this.options, ...options});
    bot.setJSONRoot(root);
    bot.addCustomParams(this.customParams);
    bot.on('message', (message) => {
      this.emit('message', message);
    });
    this.bots.push(bot);
    return bot;
  }

  addCustomParams(params: Record<string, string>) {
    this.customParams = {...params};
  }

  setSSE(sse: boolean) {
    this.tube.setSSE(sse);
  }

  private isAllBotsFinished() {
    return this.bots.every(bot => bot.state === 'finished');
  }

  async close() {
    while (!this.isAllBotsFinished()) {
      await sleep(100);
    }
    this.tube.close();
    this.bots = [];
  }

  async cancel() {
    while (!this.isAllBotsFinished()) {
      await sleep(100);
    }
    this.tube.cancel();
    this.bots = [];
  }

  sendEvent(event: any) {
    this.tube.enqueue(event, shortId());
  }

  get stream() {
    return this.tube.stream;
  }

  get canceled() {
    return this.tube.canceled;
  }

  get closed() {
    return this.tube.closed;
  }
}
