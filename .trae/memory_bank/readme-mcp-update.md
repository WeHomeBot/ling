# README文档MCP功能更新

## 更新内容

### 核心功能部分
- 在Core Features中添加了MCP (Model Context Protocol) Client Support功能
- 标注为已完成功能，说明支持工具调用和外部服务集成

### API参考部分
- 在ChatOptions接口中添加了`tool_type`字段，支持'function_call'和'tool_call'两种工具调用类型
- 新增完整的MCP Client Support章节，包括：
  - MCPClient类的使用示例
  - MCP配置类型定义
  - 主要方法说明

## 新增章节详情

### MCPClient类使用示例
```typescript
import { MCPClient } from '@bearbobo/ling/mcp';

const mcpClient = new MCPClient();

// 注册MCP服务器
mcpClient.registerServers({
  mcpServers: {
    "filesystem": {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/allowed/files"]
    },
    "brave-search": {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-brave-search"]
    }
  }
});

// 列出可用工具
const tools = await mcpClient.listTools('function_call');

// 调用工具
const result = await mcpClient.callTool('read_file', {
  path: '/path/to/file.txt'
});
```

### 配置类型定义
- `McpServerConfig`: 单个MCP服务器配置
- `McpServersConfig`: 多个MCP服务器配置集合

### 主要方法
- `registerServer()`: 注册单个MCP服务器
- `registerServers()`: 注册多个MCP服务器
- `listTools()`: 列出所有可用工具
- `callTool()`: 执行工具调用

## 状态
- ✅ 已更新核心功能列表
- ✅ 已添加ChatOptions中的tool_type字段
- ✅ 已添加完整的MCP Client Support文档
- ✅ 已提供使用示例和API说明
- ✅ 已修正MCP使用示例（基于test/server.ts的正确用法）
- ✅ 已更新方法说明，明确通过Ling类使用MCP功能

## 相关文件
- `/README.md`
- `/src/mcp/client.ts`
- `/src/types.ts`