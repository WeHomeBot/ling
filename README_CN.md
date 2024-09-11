# Ling (灵)

Ling （灵） 是一个支持 LLM 流式输出（Streaming）的工作流框架。

## Core Features

- [x] 支持 JSONL 协议的数据流输出
- [x] JSON 的 TOKEN 异常的自动修复
- [x] 支持复杂的异步工作流
- [x] 支持流式输出过程中的状态消息
- [x] 支持 Server Sent Events
- [ ] 提供 Clinet SDK

## 背景

一些复杂的AI工作流，如波波熊学伴，需要多个 Agent/Bot 协同处理结构化数据。但是，考虑实时响应，采用结构化数据输出，不利于使用流式接口提升时效性。
因为常用的 JSON 数据格式虽然灵活，但是它的结构具有完整性，也就是说，在所有内容输出完整之前，我们很难将其正确解析出来。当然我们可以采用其他一些结构数据格式，例如yaml，但是又不如 JSON 格式强大和方便。

Ling 正是为了解决这个问题而诞生的流式框架，它的核心是一个实时转换器，可以将输入的 JSON 数据流，一个字符一个字符地进行解析，将内容以 JSONURI 的方式输出。

例如，以下JSON格式：

```json
{
    outline: [
        {
        "topic": "云朵是由什么构成的？"
        },
        {
        "topic": "为什么云朵看起来软软的？"
        }
    ]
    // ...
}
```

在流式输入时，内容依次被实时转换成如下数据输出（使用 Server-sent Events）：

```
data: {"uri": "outline/0/topic", "delta": "云"}
data: {"uri": "outline/0/topic", "delta": "朵"}
data: {"uri": "outline/0/topic", "delta": "是"}
data: {"uri": "outline/0/topic", "delta": "由"}
data: {"uri": "outline/0/topic", "delta": "什"}
data: {"uri": "outline/0/topic", "delta": "么"}
data: {"uri": "outline/0/topic", "delta": "构"}
data: {"uri": "outline/0/topic", "delta": "成"}
data: {"uri": "outline/0/topic", "delta": "的"}
data: {"uri": "outline/0/topic", "delta": "？"}
data: {"uri": "outline/1/topic", "delta": "为"}
data: {"uri": "outline/1/topic", "delta": "什"}
data: {"uri": "outline/1/topic", "delta": "么"}
data: {"uri": "outline/1/topic", "delta": "云"}
data: {"uri": "outline/1/topic", "delta": "朵"}
data: {"uri": "outline/1/topic", "delta": "看"}
data: {"uri": "outline/1/topic", "delta": "起"}
data: {"uri": "outline/1/topic", "delta": "来"}
data: {"uri": "outline/1/topic", "delta": "软"}
data: {"uri": "outline/1/topic", "delta": "软"}
data: {"uri": "outline/1/topic", "delta": "的"}
data: {"uri": "outline/1/topic", "delta": "？"}
```

这样实时发送的数据，就方便了前端立即处理。

## Demo

Server 

```js
import 'dotenv/config';

import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';

import { Ling, type ChatConfig } from "@bearbobo/ling";

import { pipeline } from 'node:stream/promises';

const apiKey = process.env.API_KEY as string;
const model_name = process.env.MODEL_NAME as string;
const endpoint = process.env.ENDPOINT as string;

const app = express();

app.use(cors());
app.use(bodyParser.json());

const port = 3000;

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.post('/api', async (req, res) => {
  const question = req.body.question;

  const config: ChatConfig = {
    model_name,
    api_key: apiKey,
    endpoint: endpoint,
  };

  // ------- The work flow start --------
  const ling = new Ling(config);
  const bot = ling.createBot(/*'bearbobo'*/);
  bot.addPrompt('Respond to me in JSON format, starting with {.\n[Example]\n{"answer": "My response"}');
  bot.chat(question);
  bot.on('string-response', ({uri, delta}) => {
    // Infer the content of the string in the JSON, and send the content of the 'answer' field to the second bot.
    console.log('bot string-response', uri, delta);

    const bot2 = ling.createBot(/*'bearbobo'*/);
    bot2.addPrompt(`Expand the content I gave you into more detailed content, answer me in JSON format, place the detailed answer text in the 'details' field, and place 2-3 related knowledge points in the 'related_question' field.\n[Example]\n{"details": "My detailed answer", "related_question": [...]}`);
    bot2.chat(delta);
    bot2.on('response', (content) => {
      // Stream data push completed.
      console.log('bot2 response finished', content);
    });

    const bot3 = ling.createBot();
    bot3.addPrompt('Expand the content I gave you into more detailed content, using Chinese. answer me in JSON format, place the detailed answer in Chinese in the 'details' field.\n[Example]\n{"details_cn": "my answer..."}');
    bot3.chat(delta);
    bot3.on('response', (content) => {
      // Stream data push completed.
      console.log('bot3 response finished', content);
    });
  });
  ling.close(); // It can be directly closed, and when closing, it checks whether the status of all bots has been finished.
  // ------- The work flow end --------

  // setting below headers for Streaming the data
  res.writeHead(200, {
    'Content-Type': "text/event-stream",
    'Cache-Control': "no-cache",
    'Connection': "keep-alive"
  });

  console.log(ling.stream);

  pipeline((ling.stream as any), res);
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
```

Client

```vue
<script setup>
import { onMounted, ref } from 'vue';
import { set, get } from 'jsonuri';

const response = ref({
  answer: 'Brief:',
  details: 'Details:',
  details_eng: 'Translation:',
  related_question: [
    '?',
    '?',
    '?'
  ],
});
onMounted(async () => {
  const res = await fetch('http://localhost:3000/api', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      question: 'Can I laid on the cloud?'
    }),
  });
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let done = false;
  const data = {
    answer: 'Brief:',
    details: 'Details:',
    related_question: [],
  };
  while (!done) {
    const { value, done: doneReading } = await reader.read();
    done = doneReading;
    if(!done) {
      const content = decoder.decode(value);
      const lines = content.trim().split('\n');
      for(const line of lines) {
        const input = JSON.parse(line);
        if(input.uri) {
          const content = get(data, input.uri);
          set(data, input.uri, (content || '') + input.delta);
          response.value = {...data};
        }
      }
    }
  }
});
</script>

<template>
  <h1>Hello~</h1>
  <p>{{ response.answer }}</p>
  <p>{{ response.details }}</p>
  <p>{{ response.details_eng }}</p>
  <p v-for="item in response.related_question" :key="item.id"> >>> {{ item }}</p>
</template>
```

## Bot 事件

### string-response

当 AI 输出的 JSON 中，字符串字段输出完成时，触发这个事件，返回一个 josnuri 对象。

### inference-done

当 AI 本次推理完成时，触发这个事件，返回完整的输出内容，此时流式输出可能还没结束，数据还在继续发送给前端。

### response

当 AI 本次生成的数据已经全部发送给前端时触发。

> 注意：通常情况下，string-response 先于 inference-done 先于 response。

## Custom Event

有时候我们希望发送自定义事件给前端，让前端更新状态，可以在server使用 `ling.sendEvent({event, data})` 推送消息给前端。前端可以从流中接收到 JSON `{event, data}` 进行处理。

```js
bot.on('inference-done', () => {
  bot.sendEvent({event: 'inference-done', state: 'Outline generated!'});
});
```

也可以直接推送 jsonuri 状态，方便前端直接设置

```js
bot.on('inference-done', () => {
  bot.sendEvent({uri: 'state/outline', delta: true});
});
```

## Server-sent Events

可以通过 `ling.setSSE(true)` 转换成 [Server-sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events) 的数据格式，这样前端就可以用 `EventSource` API 来处理数据。

```js
const es = new EventSource('http://localhost:3000/?question=Can I laid on the cloud?');

es.onmessage = (e) => {
  console.log(e.data);
}

es.onopen = () => {
  console.log('Connecting');
}

es.onerror = (e) => {
  console.log(e);
}
```
