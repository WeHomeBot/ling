import EventEmitter from 'node:events';

import { ChatBot, Bot } from './bot/index';
import { Tube } from './tube';
import type { ChatConfig, ChatOptions } from "./types";
import { sleep, shortId } from './utils';

export type { ChatConfig, ChatOptions } from "./types";
export type { ChatBot } from "./bot";
export type { Tube } from "./tube";

export { Bot, WorkState } from "./bot";

export class Ling extends EventEmitter {
  protected _tube: Tube;
  protected customParams: Record<string, string> = {};
  protected bots: Bot[] = [];
  protected session_id = shortId();

  constructor(protected config: ChatConfig, protected options: ChatOptions = {}) {
    super();
    if(config.session_id) {
      this.session_id = config.session_id;
      delete config.session_id;
    }
    this._tube = new Tube(this.session_id);
    this._tube.on('message', (message) => {
      this.emit('message', message);
    });
    this._tube.on('finished', () => {
      this.emit('finished');
    });
    this._tube.on('canceled', () => {
      this.emit('canceled');
    });
    this._tube.on('error', (error) => {
      this.emit('error', error);
    });
  }

  createBot(root: string | null = null, config: Partial<ChatConfig> = {}, options: Partial<ChatOptions> = {}) {
    const bot = new ChatBot(this._tube, {...this.config, ...config}, {...this.options, ...options});
    bot.setJSONRoot(root);
    bot.setCustomParams(this.customParams);
    this.bots.push(bot);
    return bot;
  }

  addBot(bot: Bot) {
    this.bots.push(bot);
  }

  setCustomParams(params: Record<string, string>) {
    this.customParams = {...params};
  }

  setSSE(sse: boolean) {
    this._tube.setSSE(sse);
  }

  protected isAllBotsFinished() {
    return this.bots.every(bot => bot.state === 'finished' || bot.state === 'error');
  }

  async close() {
    while (!this.isAllBotsFinished()) {
      await sleep(100);
    }
    this._tube.close();
    this.bots = [];
  }

  async cancel() {
    while (!this.isAllBotsFinished()) {
      await sleep(100);
    }
    this._tube.cancel();
    this.bots = [];
  }

  sendEvent(event: any) {
    this._tube.enqueue(event);
  }

  get tube() {
    return this._tube;
  }

  get model() {
    return this.config.model_name;
  }

  get stream() {
    return this._tube.stream;
  }

  get canceled() {
    return this._tube.canceled;
  }

  get closed() {
    return this._tube.closed;
  }

  get id() {
    return this.session_id;
  }
}
