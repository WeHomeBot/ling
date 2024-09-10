import 'dotenv/config';
import { Ling } from "./index";
import type { ChatConfig } from "./adapter/types";

describe('Line', () => {
  const apiKey = process.env.API_KEY as string;
  const model_name = process.env.MODEL_NAME as string;
  const endpoint = process.env.ENDPOINT as string;

  test('bearbobo bot', done => {
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

    bot.on('string-response', ({uri, delta}) => {
      // 流数据推送完成
      console.log('bot string-response', uri, delta);

      const bot2 = ling.createBot('bearbobo');
      bot2.addPrompt('将我给你的内容扩写成更详细的内容，用JSON格式回答我，将解答内容的详细文字放在\'details\'字段里，将2-3条相关的其他知识点放在\'related_question\'字段里。\n[Example]\n{"details": "我的详细回答", "related_question": ["相关知识内容",...]}');
      bot2.chat(delta);
      bot2.on('response', (content) => {
        // 流数据推送完成
        console.log('bot2 response finished', content);
      });
    });

    const reader = ling.stream.getReader();
    reader.read().then(function processText({ done:_done, value }) : any {
      if (_done) {
        done();
        return;
      }
      console.log(value);
      return reader.read().then(processText);
    });

    ling.close(); // 可以直接关闭，关闭时会检查所有bot的状态是否都完成了
  }, 60000);
});