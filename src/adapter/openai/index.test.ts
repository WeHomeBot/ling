import 'dotenv/config';
import { Tube } from '../../tube';
import type { ChatConfig } from '../types';
import { getChatCompletions } from './index';

describe('OpenAI', () => {
  const apiKey = process.env.API_KEY as string;
  const model_name = process.env.MODEL_NAME as string;
  const endpoint = process.env.ENDPOINT as string;

  test('single completion with JSON', done => {
    const tube = new Tube();
    const messages = [
      { role: 'system', content: `你用JSON格式回答我，以{开头\n[Example]{answer: "我的回答"}` },
      { role: 'user', content: '你是谁？' },
    ];
    const config: ChatConfig = {
      model_name,
      api_key: apiKey,
      endpoint: endpoint,
    };
    
    getChatCompletions(tube, messages, config, {
      frequency_penalty: 0,
      presence_penalty: 0,
      response_format: {type: 'json_object'},
      onComplete: (content) => {
        console.log(content);
      },
    }).then(() => {
      tube.close();
    });

    const reader = tube.stream.getReader();
    reader.read().then(function processText({ done:_done, value }) : any {
      if (_done) {
        done();
        return;
      }
      console.log(value);
      return reader.read().then(processText);
    });
  }, 180000);
});