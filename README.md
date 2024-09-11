# Ling (灵)

**Ling** is a workflow framework that supports streaming of structured content generated by large language models (LLMs). It enables quick responses to content streams produced by agents or bots within the workflow, thereby reducing waiting times.

![whiteboard_exported_image (2)](https://github.com/user-attachments/assets/e105c4d5-8a8d-4049-bf2f-f3f30d6d5d5c)

## Core Features

- [x] Supports data stream output via [JSONL](https://jsonlines.org/) protocol.
- [x] Automatic correction of token errors in JSON output.
- [x] Supports complex asynchronous workflows.
- [x] Supports status messages during streaming output.
- [x] Supports [Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events).
- [ ] Provides Client SDK.

## Background

Complex AI workflows, such as those found in Bobo Bear Learning Companion, require multiple agents/bots to process structured data collaboratively. However, considering real-time responses, utilizing structured data outputs is not conducive to enhancing timeliness through a streaming interface.

The commonly used JSON data format, although flexible, has structural integrity, meaning it is difficult to parse correctly until all the content is completely outputted. Of course, other structured data formats like YAML can be adopted, but they are not as powerful and convenient as JSON.
Ling is a streaming framework created to address this issue. Its core is a real-time converter that can parse incoming JSON data streams character by character, outputting content in the form of JSONURI.

For example, consider the following JSON format:

```json
{
    "outline": [
        {
            "topic": "What are clouds made of?"
        },
        {
            "topic": "Why do clouds look soft?"
        }
    ]
    // ...
}
```

During streaming input, the content may be converted in real-time into the following data outputs (using Server-sent Events):

```
data: {"uri": "outline/0/topic", "delta": "clo"}
data: {"uri": "outline/0/topic", "delta": "uds"}
data: {"uri": "outline/0/topic", "delta": "are"}
data: {"uri": "outline/0/topic", "delta": "mad"}
data: {"uri": "outline/0/topic", "delta": "e"}
data: {"uri": "outline/0/topic", "delta": "of"}
data: {"uri": "outline/0/topic", "delta": "?"}
data: {"uri": "outline/1/topic", "delta": "Why"}
data: {"uri": "outline/1/topic", "delta": "do"}
data: {"uri": "outline/1/topic", "delta": "clo"}
data: {"uri": "outline/1/topic", "delta": "uds"}
data: {"uri": "outline/1/topic", "delta": "loo"}
data: {"uri": "outline/1/topic", "delta": "k"}
data: {"uri": "outline/1/topic", "delta": "sof"}
data: {"uri": "outline/1/topic", "delta": "t"}
data: {"uri": "outline/1/topic", "delta": "?"}
...
```

This method of real-time data transmission facilitates immediate front-end processing.

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

## Bot Events

### string-response

This event is triggered when a string field in the JSON output by the AI is completed, returning a [jsonuri](https://github.com/aligay/jsonuri) object.

### inference-done

This event is triggered when the AI has completed its current inference, returning the complete output content. At this point, streaming output may not have ended, and data continues to be sent to the front end.

### response

This event is triggered when all data generated by the AI during this session has been sent to the front end.

> Note: Typically, the `string-response` event occurs before `inference-done`, which in turn occurs before `response`.

## Custom Event

Sometimes, we might want to send custom events to the front end to update its status. On the server, you can use `ling.sendEvent({event, data})` to push messages to the front end. The front end can then receive and process JSON objects `{event, data}` from the stream.

```js
bot.on('inference-done', () => {
  bot.sendEvent({event: 'inference-done', state: 'Outline generated!'});
});
```

Alternatively, you can also directly push jsonuri status updates, making it easier for the front end to set directly.

```js
bot.on('inference-done', () => {
  bot.sendEvent({uri: 'state/outline', delta: true});
});
```

## Server-sent Events

You can force ling to response the Server-Sent Events data format by using `ling.setSSE(true)`. This allows the front end to handle the data using the EventSource API.

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
