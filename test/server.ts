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

// parse application/json
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

  const ling = new Ling(config);
  // 工作流
  const bot = ling.createBot('bearbobo');
  bot.addPrompt('你用JSON格式回答我，以{开头\n[Example]\n{"answer": "我的回答"}');
  bot.chat('木头为什么能燃烧？');
  bot.on('response', (content) => {
    // 流数据推送完成
    console.log('bot1 response finished', content);
  });
  ling.close(); // 可以直接关闭，关闭时会检查所有bot的状态是否都完成了

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
