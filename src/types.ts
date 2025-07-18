export enum ChatModel {
  GPT4 = 'gpt-4',
  GPT4Turbo = 'gpt-4-turbo',
  // GPT4Vision = 'gpt-4-vision',
  GPT4o = 'gpt-4-o',
  GPT35Turbo = 'gpt-35-turbo',
  GPT35Turbo16K = 'gpt-35-turbo-16k',
  Moonshot8K = 'moonshot-v1-8k',
  Moonshot32K = 'moonshot-v1-32k',
  Moonshot128K = 'moonshot-v1-128k',
  Deepseek = 'deepseek',
  QwenMaxLongcontext = 'qwen-max-longcontext',
  QwenLong = 'qwen-long',
  YiMedium = 'yi-medium',
}

export interface ChatConfig {
  model_name: string;
  endpoint: string;
  api_key?: string;
  api_version?: string;
  session_id?: string;
  max_tokens?: number;
  sse?: boolean;
}

export interface ChatOptions {
  temperature?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  stop?: string[];
  top_p?: number;
  response_format?: any;
  max_tokens?: number;
  quiet?: boolean;
  bot_id?: string;
  tool_type?: 'function_call' | 'tool_call';
}

/**
 * MCP 服务器配置接口
 */
export interface McpServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

/**
 * MCP 服务器集合配置接口
 */
export interface McpServersConfig {
  [name: string]: McpServerConfig;
}
