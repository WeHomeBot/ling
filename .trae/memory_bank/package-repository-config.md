# Package.json GitHub仓库配置

## 配置内容

在package.json中添加了以下GitHub仓库相关配置：

### Repository配置
```json
"repository": {
  "type": "git",
  "url": "https://github.com/bearbobo/wehomebot-ling.git"
}
```

### Bug追踪配置
```json
"bugs": {
  "url": "https://github.com/bearbobo/wehomebot-ling/issues"
}
```

### 主页配置
```json
"homepage": "https://github.com/bearbobo/wehomebot-ling#readme"
```

## 作用

1. **Repository字段**：指定项目的Git仓库地址，用于npm包管理和版本控制
2. **Bugs字段**：指定问题追踪页面，方便用户报告bug
3. **Homepage字段**：指定项目主页，通常指向README文档

## 状态
- ✅ 已配置GitHub仓库地址
- ✅ 已配置问题追踪链接
- ✅ 已配置项目主页链接

## 相关文件
- `/package.json`