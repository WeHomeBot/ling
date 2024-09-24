---
outline: deep
---

# API Reference

## types

### <sub style="color:red">type</sub> ChatConfig

```ts
interface ChatConfig {
  model_name: string;
  endpoint: string;
  api_key: string;
  api_version?: string;
  max_tokens?: number;
}
```

### <sub style="color:red">type</sub> ChatOptions

```ts
interface ChatOptions {
  temperature?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  stop?: string[];
  top_p?: number;
  response_format?: any;
  max_tokens?: number;
  quiet?: boolean;
}
```

## Ling <sub style="color: grey">extends</sub> EventEmitter

::: details constructor(private config: ChatConfig, private options: ChatOptions = {})
```ts
{
  super();
  this.tube = new Tube();
}
```

### createBot

::: details createBot(root: string | null = null, config: Partial&lt;ChatConfig&gt; = {}, options: Partial&lt;ChatOptions&gt; = {})
```ts
{
  config: Partial<ChatConfig> = {},
  options: Partial<ChatOptions> = {}) {
  const bot = new Bot(this.tube, {...this.config, ...config}, {...this.options, ...options});
  bot.setJSONRoot(root);
  bot.setCustomParams(this.customParams);
  this.bots.push(bot);
  return bot;
}
```
:::

Create a Bot object using the given config and options, where 'root' indicates the default root URI path for the output JSON content.

### setCustomParams

::: details setCustomParams(params: Record&lt;string, string&gt;)
```ts
{
  this.customParams = {...params};
}
```
:::

Add default variables to all Bot objects created for Ling, which can be used when rendering prompt templates; the prompt templates are parsed by default using [Nunjucks](https://mozilla.github.io/nunjucks/).

### setSSE

::: details setSSE(sse: boolean)
```ts
{
  this.tube.setSSE(sse);
}
```
:::

Enable or disable SSE (Server-Sent Events) mode.

::: tip
Traditionally, a web page has to send a request to the server to receive new data; that is, the page requests data from the server. With server-sent events, it's possible for a server to send new data to a web page at any time, by pushing messages to the web page. These incoming messages can be treated as Events + data inside the web page.

See more about (SSE)[https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events]
:::

### sendEvent

::: details sendEvent(event: any)
```ts
{
  this.tube.enqueue(event);
}
```
:::

### <sub style="color: grey">async</sub> close

::: details async close()
```ts
{
  while (!this.isAllBotsFinished()) {
    await sleep(100);
  }
  this.tube.close();
  this.bots = [];
}
```
:::

Close the data stream when the workflow ends.

### <sub style="color: grey">async</sub> cancel

::: details async cancel()
```ts
{
  while (!this.isAllBotsFinished()) {
    await sleep(100);
  }
  this.tube.cancel();
  this.bots = [];
}
```
:::

Cancel the stream when an exception occurs.

### <sub style="color: red">prop</sub> stream

::: details get stream()
```ts
{
  return this.tube.stream;
}
```
:::

The Readable Stream object created by Ling.

### <sub style="color: red">prop</sub> closed

::: details get closed()
```ts
{
  return this.tube.closed;
}
```
:::

Whether the workflow has been closed.

### <sub style="color: red">prop</sub> canceled

::: details get canceled()
```ts
{
  return this.tube.canceled;
}
```
:::

Whether the workflow has been canceled.

### <sub style="color: grey">event</sub> message

The message sent to client with an unique event id.

```json
{
  "id": "t2ke48g1m3:293",
  "data": { "uri": "related_question/2", "delta": "s" }
}
```

## Bot <sub style="color: grey">extends</sub> EventEmitter

### addPrompt

::: details addPrompt(promptTpl: string, promptData: Record&lt;string, string&gt; = {})
```ts
{
  const promptText = nunjucks.renderString(promptTpl, { chatConfig: this.config, chatOptions: this.options, ...this.customParams, ...promptData, });
  this.prompts.push({ role: "system", content: promptText });
}
```
:::

Set the prompt for the current Bot, supporting Nunjucks templates.

### addHistory

::: details addHistory(messages: ChatCompletionMessageParam [])
```ts
{
  this.history.push(...messages);
}
```
:::

Add chat history records.

### <sub style="color: grey">async</sub> chat

::: details async chat(message: string)
```ts
{
  this.chatState = ChatState.CHATTING;
  const messages = [...this.prompts, ...this.history, { role: "user", content: message }];
  return getChatCompletions(this.tube, messages, this.config, this.options, 
    (content) => { // on complete
      this.chatState = ChatState.FINISHED;
      this.emit('response', content);
    }, (content) => { // on string response
      this.emit('string-response', content);
    }, ({id, data}) => {
      this.emit('message', {id, data});
    }).then((content) => {
      this.emit('inference-done', content);
    });
}
```
:::

### <sub style="color: grey">event</sub> string-response

This event is triggered when a string field in the JSON output by the AI is completed, returning a [jsonuri](https://github.com/aligay/jsonuri) object.

### <sub style="color: grey">event</sub> inference-done

This event is triggered when the AI has completed its current inference, returning the complete output content. At this point, streaming output may not have ended, and data continues to be sent to the front end.

### <sub style="color: grey">event</sub> response

This event is triggered when all data generated by the AI during this session has been sent to the front end.

::: info
Typically, the `string-response` event occurs before `inference-done`, which in turn occurs before `response`.
:::
