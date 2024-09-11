# Ling (灵)

Ling （灵） 是一个支持 LLM 流式输出（Streaming）的工作流框架。

## Core Features

- [x] 支持 JSONL 协议的数据流输出
- [x] JSON 的 TOKEN 异常的自动修复
- [x] 支持复杂的异步工作流
- [x] 支持流式输出过程中的状态消息
- [x] 支持 Server Sent Events
- [ ] 提供 Clinet SDK

## Demo

Server 

```js
import 'dotenv/config';

import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';

import { Ling } from "../src/index";
import type { ChatConfig } from "../src/adapter/types";

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
  bot.addPrompt('你用JSON格式回答我，以{开头\n[Example]\n{"answer": "我的回答"}');
  bot.chat(question);
  bot.on('string-response', ({uri, delta}) => {
    // JSON中的字符串内容推理完成，将 anwser 字段里的内容发给第二个 bot
    console.log('bot string-response', uri, delta);

    const bot2 = ling.createBot(/*'bearbobo'*/);
    bot2.addPrompt('将我给你的内容扩写成更详细的内容，用JSON格式回答我，将解答内容的详细文字放在\'details\'字段里，将2-3条相关的其他知识点放在\'related_question\'字段里。\n[Example]\n{"details": "我的详细回答", "related_question": ["相关知识内容",...]}');
    bot2.chat(delta);
    bot2.on('response', (content) => {
      // 流数据推送完成
      console.log('bot2 response finished', content);
    });

    const bot3 = ling.createBot();
    bot3.addPrompt('将我给你的内容**用英文**扩写成更详细的内容，用JSON格式回答我，将解答内容的详细英文放在\'details_eng\'字段里。\n[Example]\n{"details_eng": "my answer..."}');
    bot3.chat(delta);
    bot3.on('response', (content) => {
      // 流数据推送完成
      console.log('bot3 response finished', content);
    });
  });
  ling.close(); // 可以直接关闭，关闭时会检查所有bot的状态是否都完成了
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
  answer: '简答：',
  details: '详解：',
  details_eng: 'English Answer:',
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
      question: '我能躺在云上吗？'
    }),
  });
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let done = false;
  const data = {
    answer: '简答：',
    details: '详解：',
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
  bot.sendEvent({event: 'inference-done', state: '大纲生成完毕'});
});
```

也可以直接推送 jsonuri 状态，方便前端直接设置

```js
bot.on('inference-done', () => {
  bot.sendEvent({uri: 'tocReady', delta: true});
});
```
