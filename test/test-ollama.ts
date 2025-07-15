import ollama from 'ollama';

async function main() {
  const message = { role: 'user', content: '列出当前目录下的文件' };
  const response = await ollama.chat({
    model: 'qwen3:1.7b',
    messages: [
      {
        role: 'system',
        content: '如有需要，你可以调用DirFiles工具查找当前目录下的文件和文件夹',
      },
      message,
    ],
    stream: true,
    think: true,
    tools: [
      {
        type: 'function',
        function: {
          name: 'DirFiles',
          description: '列出当前目录下的文件和文件夹',
        },
      },
    ],
  });
  for await (const part of response) {
    process.stdout.write(JSON.stringify(part.message));
  }
}

main();
