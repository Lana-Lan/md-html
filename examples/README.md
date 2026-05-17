# Claude Code 项目分析文档索引

本目录包含对 Claude Code CLI 项目 src/ 目录下所有文件的业务逻辑分析，使用 Mermaid 图表展示调用关系和流程1。

fds

## 文档列表

| 文档 | 内容 |
| --- | --- |
| [architecture-overview.md](architecture-overview.md) | 项目架构总览：技术栈、目录结构、核心层级图、Feature Flag系统、Stub模块 |
| [call-relationships.md](call-relationships.md) | 模块调用关系图：核心依赖、查询引擎依赖、UI组件依赖、服务层依赖、命令系统依赖、Provider选择链路、数据流概览 |
| [call-flow.md](call-flow.md) | 调用流程图：启动流程(时序图)、用户消息查询流程、工具执行详细流程、API请求构建与流式响应处理、上下文压缩流程、命令处理流程、完整输入-输出流程 |
| [tool-and-state.md](tool-and-state.md) | 工具系统与状态管理：工具接口定义(class图)、注册与发现流程、工具分类全景图、并发执行管理、三层状态体系、Store机制、onChangeAppState回调链、CLAUDE.md发现与加载、UI-状态连接、状态流向总览1 |

## 关键发现摘要

### 启动链路

`cli.tsx` → `main.tsx` → `init()` (初始化全局状态/认证/代理) → `setup()` → `launchRepl()` → `<App><REPL/></App>`

### 查询核心循环

`QueryEngine.submitMessage()` → `processUserInput()` → `queryLoop()` → 压缩检查 → `queryModelWithStreaming()` → 流式响应处理 → 工具执行 → 递归下一轮

### 状态体系

-   **Bootstrap State**: 模块单例，非响应式，核心运行时数据
-   **AppState**: React响应式Store，UI驱动，useSyncExternalStore订阅
-   **Context**: memoized缓存，API调用时构建系统上下文

### 工具系统

56+ 内置工具 + MCP外部工具，通过 `assembleToolPool` 合并去重，`StreamingToolExecutor` 管理并发执行，权限系统控制工具访问

### Provider支持

Anthropic直连(默认) / AWS Bedrock / Google Vertex / Azure Foundry，通过环境变量切换