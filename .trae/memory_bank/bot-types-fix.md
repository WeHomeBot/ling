# Bot模块类型导出修复

## 问题描述
- OpenAI从v4升级到v5后，类型导出路径发生变化
- bot/index.ts中的类型导入路径过时，导致类型错误

## 修复内容
- 修复了`ChatCompletionAssistantMessageParam`、`ChatCompletionSystemMessageParam`、`ChatCompletionUserMessageParam`、`ChatCompletionContentPart`等类型的导入路径
- 从`"openai/resources/index"`更改为`"openai/resources/chat/completions"`

## 影响范围
- bot/index.ts文件
- ChatBot类的类型定义
- 消息参数类型定义

## 状态
- ✅ 已修复类型导入路径
- ✅ 已修复OpenAI适配器中的reasoning属性问题
- ✅ TypeScript编译通过
- ✅ 修复完成

## 相关文件
- `/src/bot/index.ts`
- `/src/adapter/openai/index.ts` (已使用正确的命名空间路径)