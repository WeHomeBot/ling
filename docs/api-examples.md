---
outline: deep
---

# API Reference

## Types

### <sub style="color:red">type</sub> ChatConfig

```ts
interface ChatConfig {
  model_name: string;      // LLM model name
  endpoint: string;        // API endpoint
  api_key: string;         // API key
  api_version?: string;    // API version (for some providers)
  session_id?: string;     // Custom session ID
  max_tokens?: number;     // Maximum tokens to generate
  sse?: boolean;           // Enable Server-Sent Events
}
```

### <sub style="color:red">type</sub> ChatOptions

```ts
interface ChatOptions {
  temperature?: number;        // Controls randomness (0-1)
  presence_penalty?: number;   // Penalizes repetition
  frequency_penalty?: number;  // Penalizes frequency
  stop?: string[];            // Stop sequences
  top_p?: number;             // Nucleus sampling parameter
  response_format?: any;       // Response format settings
  max_tokens?: number;        // Maximum tokens to generate
  quiet?: boolean;            // Suppress output
  bot_id?: string;            // Custom bot ID
}
```

## Ling <sub style="color: grey">extends</sub> EventEmitter

The main class for managing LLM interactions and workflows.

```typescript
new Ling(config: ChatConfig, options?: ChatOptions)
```

::: details constructor(private config: ChatConfig, private options: ChatOptions = {})
```ts
{
  super();
  this.tube = new Tube();
}
```
:::

### Methods

#### createBot

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

Creates a new ChatBot instance. The 'root' parameter indicates the default root URI path for the output JSON content.

#### addBot

::: details addBot(bot: Bot)
```ts
{
  this.bots.push(bot);
}
```
:::

Adds an existing Bot to the workflow.

#### setCustomParams

::: details setCustomParams(params: Record&lt;string, string&gt;)
```ts
{
  this.customParams = {...params};
}
```
:::

Sets custom parameters for template rendering. Add default variables to all Bot objects created for Ling, which can be used when rendering prompt templates; the prompt templates are parsed by default using [Nunjucks](https://mozilla.github.io/nunjucks/).

#### setSSE

::: details setSSE(sse: boolean)
```ts
{
  this.tube.setSSE(sse);
}
```
:::

Enables or disables Server-Sent Events mode.

::: tip
Traditionally, a web page has to send a request to the server to receive new data; that is, the page requests data from the server. With server-sent events, it's possible for a server to send new data to a web page at any time, by pushing messages to the web page. These incoming messages can be treated as Events + data inside the web page.

See more about [SSE](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
:::

#### sendEvent

::: details sendEvent(event: any)
```ts
{
  this.tube.enqueue(event);
}
```
:::

#### <sub style="color: grey">async</sub> close

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

Closes all connections and waits for bots to finish. Close the data stream when the workflow ends.

#### <sub style="color: grey">async</sub> cancel

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

Cancels all ongoing operations. Cancel the stream when an exception occurs.

### Properties

#### <sub style="color: red">prop</sub> tube

::: details get tube()
```ts
{
  return this._tube;
}
```
:::

Gets the underlying Tube instance.

#### <sub style="color: red">prop</sub> model

::: details get model()
```ts
{
  return this.config.model_name;
}
```
:::

Gets the model name.

#### <sub style="color: red">prop</sub> stream

::: details get stream()
```ts
{
  return this.tube.stream;
}
```
:::

Gets the ReadableStream object created by Ling.

#### <sub style="color: red">prop</sub> id

::: details get id()
```ts
{
  return this.config.session_id || this.tube.id;
}
```
:::

Gets the session ID.

#### <sub style="color: red">prop</sub> closed

::: details get closed()
```ts
{
  return this.tube.closed;
}
```
:::

Whether the workflow has been closed.

#### <sub style="color: red">prop</sub> canceled

::: details get canceled()
```ts
{
  return this.tube.canceled;
}
```
:::

Whether the workflow has been canceled.

### Events

#### <sub style="color: grey">event</sub> message

Emitted when a message is received. The message sent to client with an unique event id.

```json
{
  "id": "t2ke48g1m3:293",
  "data": { "uri": "related_question/2", "delta": "s" }
}
```

#### <sub style="color: grey">event</sub> finished

Emitted when all operations are finished.

#### <sub style="color: grey">event</sub> canceled

Emitted when operations are canceled.

#### <sub style="color: grey">event</sub> inference-done

Emitted when a bot completes inference.
```

## ChatBot <sub style="color: grey">extends</sub> EventEmitter

Handles individual chat interactions with LLMs.

```typescript
new ChatBot(tube: Tube, config: ChatConfig, options?: ChatOptions)
```

### Methods

#### addPrompt

::: details addPrompt(promptTpl: string, promptData: Record&lt;string, any&gt; = {})
```ts
{
  const promptText = nunjucks.renderString(promptTpl, { chatConfig: this.config, chatOptions: this.options, ...this.customParams, ...promptData, });
  this.prompts.push({ role: "system", content: promptText });
}
```
:::

Adds a system prompt with template support. Set the prompt for the current Bot, supporting Nunjucks templates.

#### setPrompt

::: details setPrompt(promptTpl: string, promptData: Record&lt;string, string&gt; = {})
```ts
{
  const promptText = nunjucks.renderString(promptTpl, { chatConfig: this.config, chatOptions: this.options, ...this.customParams, ...promptData, });
  this.prompts = [{ role: "system", content: promptText }];
}
```
:::

Sets a single system prompt, replacing any existing prompts.

#### addHistory

::: details addHistory(messages: ChatCompletionMessageParam [])
```ts
{
  this.history.push(...messages);
}
```
:::

Adds message history records.

#### setHistory

::: details setHistory(messages: ChatCompletionMessageParam [])
```ts
{
  this.history = [...messages];
}
```
:::

Sets message history, replacing any existing history.

#### addFilter

::: details addFilter(filter: ((data: any) => boolean) | string | RegExp | FilterMap)
```ts
{
  this.tube.addFilter(filter);
}
```
:::

Adds a filter for messages.

#### clearFilters

::: details clearFilters()
```ts
{
  this.tube.clearFilters();
}
```
:::

Clears all filters.

#### <sub style="color: grey">async</sub> chat

::: details async chat(message: string | ChatCompletionContentPart[])
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

Starts a chat with the given message.

#### finish

::: details finish()
```ts
{
  this.chatState = ChatState.FINISHED;
}
```
:::

Marks the bot as finished.

### Events

#### <sub style="color: grey">event</sub> string-response

Emitted for text responses. This event is triggered when a string field in the JSON output by the AI is completed, returning a [jsonuri](https://github.com/aligay/jsonuri) object.

#### <sub style="color: grey">event</sub> object-response

Emitted for object responses.

#### <sub style="color: grey">event</sub> inference-done

Emitted when inference is complete. This event is triggered when the AI has completed its current inference, returning the complete output content. At this point, streaming output may not have ended, and data continues to be sent to the front end.

#### <sub style="color: grey">event</sub> response

Emitted when the full response is complete. This event is triggered when all data generated by the AI during this session has been sent to the front end.

::: info
Typically, the `string-response` event occurs before `inference-done`, which in turn occurs before `response`.
:::

#### <sub style="color: grey">event</sub> error

Emitted on errors.
