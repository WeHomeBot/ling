# ESLint Jest 插件配置记录

## 配置目标
为项目配置 eslint-plugin-jest 插件，增加对测试文件的专门 lint 检查。

## 实施内容

### 1. 更新 ESLint 配置文件
在 `eslint.config.js` 中添加：

#### 新增依赖引入
```javascript
const jest = require('eslint-plugin-jest');
```

#### 新增 Jest 测试文件专用配置
```javascript
// Jest 测试文件配置
{
  files: ['**/*.test.{js,ts}', '**/*.spec.{js,ts}', 'test/**/*.{js,ts}'],
  languageOptions: {
    parser: tseslint.parser,
    ecmaVersion: 2020,
    sourceType: 'module',
    globals: {
      ...require('globals').node,
      ...require('globals').jest,
    },
  },
  plugins: {
    '@typescript-eslint': tseslint.plugin,
    prettier: prettier,
    jest: jest,
  },
  rules: {
    // 基础规则
    'prettier/prettier': 'error',
    '@typescript-eslint/no-unused-vars': 'warn',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-require-imports': 'warn',
    // Jest 特定规则
    'jest/no-disabled-tests': 'warn',
    'jest/no-focused-tests': 'error',
    'jest/no-identical-title': 'error',
    'jest/prefer-to-have-length': 'warn',
    'jest/valid-expect': 'error',
    'jest/valid-describe-callback': 'error',
    'jest/no-conditional-expect': 'error',
    'jest/no-deprecated-functions': 'warn',
    'jest/prefer-strict-equal': 'warn',
    'jest/prefer-to-be': 'warn',
    'jest/prefer-to-contain': 'warn',
  },
}
```

### 2. 更新 package.json 脚本
新增和修改的 npm 脚本：

```json
"lint": "eslint 'src/**/*.ts' 'test/**/*.ts' --fix",
"lint:check": "eslint 'src/**/*.ts' 'test/**/*.ts'",
"lint:src": "eslint 'src/**/*.ts' --fix",
"lint:test": "eslint 'test/**/*.ts' 'src/**/*.test.ts' --fix"
```

## 配置特点

### 文件匹配模式
- `**/*.test.{js,ts}` - 测试文件（如 `index.test.ts`）
- `**/*.spec.{js,ts}` - 规范文件（如 `component.spec.ts`）
- `test/**/*.{js,ts}` - test 目录下的所有文件

### Jest 全局变量
自动识别 Jest 全局变量：
- `describe`, `it`, `test`
- `expect`, `beforeEach`, `afterEach`
- `beforeAll`, `afterAll`
- `jest` 对象等

### 关键 Jest 规则说明

| 规则 | 级别 | 说明 |
|------|------|------|
| `jest/no-disabled-tests` | warn | 警告跳过的测试 |
| `jest/no-focused-tests` | error | 禁止 `.only` 测试 |
| `jest/no-identical-title` | error | 禁止重复的测试标题 |
| `jest/prefer-to-have-length` | warn | 建议使用 `toHaveLength` |
| `jest/valid-expect` | error | 确保 expect 调用有效 |
| `jest/prefer-strict-equal` | warn | 建议使用 `toStrictEqual` |
| `jest/prefer-to-be` | warn | 建议使用 `toBe` 而非 `toEqual` |
| `jest/prefer-to-contain` | warn | 建议使用 `toContain` |

## 验证结果

✅ **配置成功**：
- ESLint 现在可以正确识别测试文件
- Jest 特定规则正常工作（如 `jest/prefer-strict-equal` 警告）
- 测试文件中的 Jest 全局变量不再报错
- 可以使用 `pnpm run lint:test` 单独检查测试文件

⚠️ **待优化问题**：
- 仍有一些 TypeScript 类型注解警告需要手动修复
- 部分未使用变量需要清理
- 建议逐步采用更严格的 Jest 断言方法

## 使用建议

1. **日常开发**：使用 `pnpm run lint` 检查所有文件
2. **测试专用**：使用 `pnpm run lint:test` 只检查测试文件
3. **源码专用**：使用 `pnpm run lint:src` 只检查源码文件
4. **CI/CD**：使用 `pnpm run lint:check` 进行检查而不自动修复

## 相关文件
- `eslint.config.js` - ESLint 主配置文件
- `package.json` - npm 脚本配置
- `jest.config.js` - Jest 测试配置（已存在）