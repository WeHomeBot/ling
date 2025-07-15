import 'dotenv/config';

import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';

import { Ling } from '../src/index';
import type { ChatConfig } from '../src/types';

import { pipeline } from 'node:stream/promises';

const apiKey = process.env.API_KEY as string;
const model_name = process.env.MODEL_NAME as string;
const endpoint = process.env.ENDPOINT as string;

const app = express();

app.use(cors());

// parse application/json
app.use(bodyParser.json());

const port = 3000;

function workflow(question: string, sse: boolean = false) {
  const config: ChatConfig = {
    model_name,
    api_key: apiKey,
    endpoint: endpoint,
  };

  const ling = new Ling(config);
  ling.setSSE(sse);

  // 工作流
  const bot = ling.createBot(/*'bearbobo'*/);
  bot.addPrompt('你用JSON格式回答我，以{开头\n[Example]\n{"answer": "我的回答"}');
  bot.chat(question);
  bot.on('string-response', ({ uri, delta }) => {
    // JSON中的字符串内容推理完成，将 anwser 字段里的内容发给第二个 bot
    console.log('bot string-response', uri, delta);

    const bot2 = ling.createBot(/*'bearbobo'*/);
    bot2.addPrompt(
      '将我给你的内容扩写成更详细的内容，用JSON格式回答我，将解答内容的详细文字放在\'details\'字段里，将2-3条相关的其他知识点放在\'related_question\'字段里。\n[Example]\n{"details": "我的详细回答", "related_question": ["相关知识内容",...]}'
    );
    bot2.chat(delta);
    bot2.on('response', content => {
      // 流数据推送完成
      console.log('bot2 response finished', content);
    });

    const bot3 = ling.createBot();
    bot3.addPrompt(
      '将我给你的内容**用英文**扩写成更详细的内容，用JSON格式回答我，将解答内容的详细英文放在\'details_eng\'字段里。\n[Example]\n{"details_eng": "my answer..."}'
    );
    bot3.chat(delta);
    bot3.on('response', content => {
      // 流数据推送完成
      console.log('bot3 response finished', content);
    });
  });

  ling.on('message', message => {
    console.log('ling message', message);
  });

  ling.close(); // 可以直接关闭，关闭时会检查所有bot的状态是否都完成了

  return ling;
}

app.get('/', async (req, res) => {
  // setting below headers for Streaming the data
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const question = req.query.question as string;
  const ling = workflow(question, true);
  try {
    await pipeline(ling.stream as any, res);
  } catch (ex) {
    ling.cancel();
  }
});

app.get('/ai/chat', async (req, res) => {
  // setting below headers for Streaming the data
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const question = req.query.question as string;
  const config: ChatConfig = {
    model_name,
    api_key: apiKey,
    endpoint: endpoint,
  };

  const ling = new Ling(config);
  ling.setSSE(true);

  ling.registerMCPServers({
    mcpServers: {
      filesystem: {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', process.cwd()],
      },
    },
  });

  const bot = ling.createBot('reply', undefined, {
    response_format: { type: 'text' },
  });
  // bot.addPrompt(prompt);
  console.log(question);
  bot.chat(question);
  ling.close();

  try {
    await pipeline(ling.stream as any, res);
  } catch (ex) {
    ling.cancel();
  }
});

app.post('/api', async (req, res) => {
  // res.writeHead(200, {
  //   'Content-Type': "text/event-stream",
  //   'Cache-Control': "no-cache",
  //   'Connection': "keep-alive"
  // });

  const question = req.body.question;
  const ling = workflow(question);
  try {
    await pipeline(ling.stream as any, res);
  } catch (ex) {
    ling.cancel();
  }
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
