# 项目技术规范

## 技术栈
- Node.js v18+
- TypeScript (严格模式)
- 输出格式：CommonJS (cjs)
- 包管理：pnpm
- 测试框架：Jest
- 代码规范：ESLint + Prettier

## 项目结构
```
src/
├── adapter/     # 适配器模块
├── bot/         # 机器人核心
├── flow/        # 流程控制
├── mcp/         # MCP客户端
├── parser/      # 解析器
├── tube/        # 管道模块
├── types.ts     # 全局类型定义
└── utils/       # 工具函数
```

## 开发原则
- 使用具名导出，禁止默认导出
- 所有函数必须有明确的类型注解
- 所有模块必须支持 Tree-shaking
- 函数/类注释需包含用途说明、参数定义和示例用法
- 严格遵循 ESLint + Prettier 风格

## 命名规范
- 文件名：kebab-case
- 函数名：camelCase
- 类名：PascalCase
- 常量：UPPER_SNAKE_CASE
- 类型：PascalCase

## 测试规则
- 所有核心逻辑必须编写测试覆盖
- 测试文件放在同级目录或tests/目录下
- 测试覆盖率建议90%以上