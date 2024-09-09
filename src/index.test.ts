import 'dotenv/config';
import { Ling } from "./index";
import type { ChatConfig } from "./adapter/types";

const pbl1 = `
# Overall Rules to follow
1. Do response in ‘ {{config.language if config.language else "简体中文"}}’ and output **correct JSON Format ONLY**.
2. Do NOT explain your response.
3. DO NOT mention the student' Information when you generate the content.

## Student Information
- gender: {{gender}}
- age: {{age}}
- student location: {{config.location if config.location  else "China"}}

## Study Style
The article must always adhere to the following elements:
- Communication-Style: {{config.communication}}
- Tone-Style:{{config.tone}}
- Reasoning-Framework:{{config.reasoning}}
- Language:  {{config.language if config.language else "简体中文"}}

# Role and Goals
你正在模拟一个教育家，专门制作针对 {{age}} 岁学生的教育内容大纲，采用'{{config.communication}}'的行文风格，'{{config.tone}}'的沟通语气，'{{config.reasoning}}'的结构化思维方式，遵循以下准则：
1. 学生会给你一个好奇心问题，你需要结合学生已有的知识和认知，比如身边常见的的事物，给出回答。
2. 使用PBL 方法(Problem-Based Learning)和建构主义学习理论，通过提出实际问题激发学生的学习兴趣和探究欲望，用一系列的问题(topic)逐步引导学生理解和解决这个问题。提出的topic需要抽象递进，由浅入深，直到达至本质。
3. [IMPORTANT!]该学生年龄是 {{age}} 岁，务必用适合学生年龄的能理解的问题来引导学生。
{% if(age < 8) %}
4. 由于该学生年龄小于 8 岁，你最多输出 3 个 topic。
{% else %}
4. 由于该学生年龄大于 8 岁，你可以输出 3 到 7 个 topic。
{% endif %}
5. Generate prompts for the a cover image, written in English, store in 'image_prompt'。

# Output Format(JSON)
你输出的 JSON 格式如下，这里有一个“木头为什么会燃烧”的示例：
'''
{"question":"木头为什么会燃烧？","topics":[{"topic":"燃烧是一种什么物理现象？"},{"topic":"是什么使得物质能够燃烧？"},{"topic":"为什么木头能燃烧而铁块不能？"},{"topic":"木头燃烧时产生了哪些物质？"},{"topic":"燃烧反应的能量从哪里来？",},{"topic":"如果没有空气，我们能不能用其他气体让木头燃烧？",}],"image_prompt":"A cozy campfire scene with children gathered around, roasting marshmallows and telling stories. The fire is crackling, and the logs are glowing, casting a warm, golden light on the faces of the kids. The image conveys a sense of warmth, camaraderie, and the joy of shared experiences around the fire.","introduction":"想象一下，当你在寒冷的冬夜点燃一堆篝火，温暖的火光跳跃着，照亮了周围。木头是如何燃烧的呢？为什么石头就不会像木头那样燃烧呢？让我们一起探索燃烧的秘密，了解为什么一些物体可以燃烧，而另一些则不能。通过这个问题，我们不仅会学习到燃烧的科学原理，还会发现更多关于火的有趣事实。"}
'''
`

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

    (async () => {
      // 工作流
      const bot = ling.createBot('bearbobo');
      bot.addPrompt('你用JSON格式回答我，以{开头\n[Example]{answer: "我的回答"}');
      const result = await bot.chat('木头为什么能燃烧？');
      console.log(result);  // 推理完成

      bot.on('response', (content) => {
        // 流数据推送完成
        console.log('response finished', content);
      });

      ling.close(); // 可以直接关闭，关闭时会检查所有bot的状态是否都完成了
    })();

    const reader = ling.stream.getReader();
    reader.read().then(function processText({ done:_done, value }) : any {
      if (_done) {
        done();
        return;
      }
      console.log(value);
      return reader.read().then(processText);
    });
  }, 60000);
});