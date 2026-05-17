# Claude Code 调用流程图

示例图如下所示

change 141

## 启动流程

```mermaid
sequenceDiagram
    participant User as 用户终端
    participant CLI as cli.tsx
    participant MAIN as main.tsx
    participant INIT as init.ts
    participant BOOT as bootstrap/state.ts
    participant CMD as Commander.js
    participant SETUP as setup.ts
    participant LAUNCH as replLauncher.tsx
    participant APP as App.tsx
    participant REPL as REPL.tsx

    User->>CLI: 执行 bun run dev

    CLI->>CLI: 解析 process.argv
    CLI->>CLI: 注入 MACRO 全局变量
    CLI->>CLI: 注入 feature() polyfill (always false)
    CLI->>CLI: 设置 BUILD_TARGET/BUILD_ENV/INTERFACE_TYPE

    alt 快速路径 (--version, --dump-system-prompt 等)
        CLI->>CLI: 直接处理并退出
    else 正常CLI执行
        CLI->>MAIN: import("../main.jsx") → main()

        MAIN->>MAIN: 模块级副作用
        Note over MAIN: profileCheckpoint('main_tsx_entry')
        Note over MAIN: startMdmRawRead()
        Note over MAIN: startKeychainPrefetch()

        MAIN->>CMD: 创建 Commander program

        CMD->>INIT: preAction hook → await init()
        INIT->>BOOT: 初始化全局状态
        Note over INIT: enableConfigs()
        Note over INIT: applySafeConfigEnvironmentVariables()
        Note over INIT: applyExtraCACertsFromConfig()
        Note over INIT: setupGracefulShutdown()
        Note over INIT: initialize1PEventLogging()
        Note over INIT: populateOAuthAccountInfoIfNeeded()
        Note over INIT: initJetBrainsDetection()
        Note over INIT: detectCurrentRepository()
        Note over INIT: initializeRemoteManagedSettingsLoadingPromise()
        Note over INIT: initializePolicyLimitsLoadingPromise()
        Note over INIT: configureGlobalMTLS()
        Note over INIT: configureGlobalAgents()
        Note over INIT: preconnectAnthropicApi()

        CMD->>SETUP: action handler → setup()
        SETUP->>LAUNCH: launchRepl(root, appProps, replProps)

        LAUNCH->>APP: import('./components/App.js')
        LAUNCH->>REPL: import('./screens/REPL.js')
        LAUNCH->>APP: renderAndRun(<App><REPL/></App>)

        APP->>APP: FpsMetricsProvider → StatsProvider → AppStateProvider
        REPL->>REPL: 初始化REPL组件
        REPL->>User: 显示交互式终端UI
    end
```

## 用户消息查询流程

```mermaid
sequenceDiagram
    participant User as 用户
    participant PROMPT as PromptInput
    participant QE as QueryEngine
    participant PROCESS as processUserInput
    participant QL as queryLoop
    participant COMPACT as 压缩服务
    participant API as services/api/claude.ts
    participant SDK as Anthropic SDK
    participant TOOL as 工具系统
    participant STATE as AppState

    User->>PROMPT: 输入消息
    PROMPT->>QE: submitMessage(prompt, options)

    QE->>PROCESS: processUserInput()
    Note over PROCESS: 解析斜杠命令
    Note over PROCESS: 处理附件
    Note over PROCESS: 确定模型

    QE->>QE: 构建系统提示词
    Note over QE: customPrompt + memoryMechanicsPrompt + appendSystemPrompt

    QE->>QE: 加载技能和插件
    Note over QE: getSlashCommandToolSkills()
    Note over QE: loadAllPluginsCacheOnly()

    QE->>QL: query(config)

    QL->>COMPACT: 压缩检查
    Note over COMPACT: snipCompactIfNeeded()
    Note over COMPACT: microcompactMessages()
    Note over COMPACT: contextCollapse.applyCollapsesIfNeeded()
    Note over COMPACT: autoCompactIfNeeded()

    QL->>API: deps.callModel() = queryModelWithStreaming()

    API->>API: 构建请求参数
    Note over API: normalizeMessagesForAPI()
    Note over API: buildSystemPromptBlocks()
    Note over API: toolToAPISchema()
    Note over API: 配置beta headers (thinking, caching)

    API->>SDK: anthropic.beta.messages.create({stream: true})

    loop 流式响应事件
        SDK->>API: message_start
        SDK->>API: content_block_start
        SDK->>API: content_block_delta (文本/工具调用)
        SDK->>API: content_block_stop
        SDK->>API: message_delta (usage/cost)
        SDK->>API: message_stop
        API->>QL: yield 事件消息
        QL->>STATE: 更新UI状态
        STATE->>User: 渲染消息
    end

    alt 包含工具调用
        QL->>QL: 提取 tool_use blocks
        QL->>TOOL: runTools(toolUseBlocks, ...)
        loop 每个工具
            TOOL->>TOOL: 查找工具定义
            TOOL->>TOOL: 验证输入 schema
            TOOL->>TOOL: 检查权限 canUseTool()
            TOOL->>TOOL: tool.call(input, context)
            TOOL->>QL: 返回 ToolResult
            QL->>STATE: 更新UI
            STATE->>User: 显示工具结果
        end
        QL->>QL: 递归下一轮
    else 无工具调用(纯文本)
        QL->>QE: 返回最终结果
        QE->>STATE: 更新消息列表
        STATE->>User: 显示完整回复
    end
```

## 工具执行详细流程

```mermaid
sequenceDiagram
    participant QL as queryLoop
    participant STE as StreamingToolExecutor
    participant FIND as findToolByName
    participant TOOL as Tool.call()
    participant PERM as canUseTool
    participant PERM_UI as PermissionRequest UI
    participant USER as 用户
    participant EXEC as 工具执行逻辑
    participant RESULT as ToolResult

    QL->>STE: 添加工具调用到队列
    STE->>STE: addTool(toolUseBlock)

    STE->>FIND: findToolByName(tools, toolName)
    FIND->>FIND: 在内置工具和MCP工具中查找

    STE->>PERM: canUseTool(tool, input)
    alt 权限自动允许
        PERM->>STE: 允许
    else 需要用户审批
        PERM->>PERM_UI: 显示权限请求
        PERM_UI->>USER: 请求确认
        USER->>PERM_UI: 允许/拒绝
        alt 用户允许
            PERM_UI->>PERM: 允许
        else 用户拒绝
            PERM_UI->->>STE: 拒绝 → 返回拒绝消息
        end
    end

    STE->>TOOL: tool.inputSchema.safeParse(input)
    alt 验证成功
        STE->->>EXEC: tool.call(input, context, canUseTool, message, onProgress)
        loop 进度更新
            EXEC->>STE: onProgress(progressMessage)
            STE->>USER: 显示进度
        end
        EXEC->>RESULT: 返回 {data, newMessages, contextModifier}
        RESULT->>STE: 处理结果
        alt 结果超过 maxResultSizeChars
            STE->>STE: toolResultStorage.persistToDisk()
        else 结果在内存中
            STE->>STE: 直接存储结果
        end
    else 验证失败
        STE->->>QL: 返回验证错误消息
    end

    STE->>QL: 所有工具结果完成

    QL->>QL: 构建工具结果消息
    QL->>QL: 递归进入下一轮对话
```

## API请求构建与流式响应处理流程

```mermaid
sequenceDiagram
    participant QL as queryLoop
    participant API as claude.ts
    participant BUILD as 请求构建
    participant CLIENT as getAnthropicClient
    participant PROV as Provider选择
    participant SDK as Anthropic SDK
    participant STREAM as SSE流
    participant PROCESS as 事件处理

    QL->>API: queryModelWithStreaming(messages, config)

    API->>API: withStreamingVCR(messages, queryModel)

    API->>BUILD: queryModel() - 构建请求
    Note over BUILD: 1. 获取 previousRequestId
    Note over BUILD: 2. resolveModel() - Bedrock inference profiles
    Note over BUILD: 3. buildToolSchema() - defer_loading
    Note over BUILD: 4. normalizeMessagesForAPI()
    Note over BUILD: 5. buildSystemPromptBlocks()
    Note over BUILD: 6. 配置beta headers (thinking, caching)
    Note over BUILD: 7. 配置effort params
    Note over BUILD: 8. 配置task budget

    API->>CLIENT: getAnthropicClient(config)
    CLIENT->>PROV: getAPIProvider()
    Note over PROV: 检测环境变量选择Provider:
    Note over PROV: CLAUDE_CODE_USE_BEDROCK → bedrock
    Note over PROV: CLAUDE_CODE_USE_VERTEX → vertex
    Note over PROV: CLAUDE_CODE_USE_FOUNDRY → foundry
    Note over PROV: 默认 → firstParty (api.anthropic.com)

    CLIENT->>CLIENT: 配置认证 (OAuth/API key)
    CLIENT->>CLIENT: 配置请求头 (x-app, User-Agent)
    CLIENT->>CLIENT: 配置代理/mTLS

    CLIENT->>SDK: 创建 Anthropic SDK client

    API->>API: withRetry(() => ...)
    API->>SDK: anthropic.beta.messages.create({params, stream:true})

    SDK->>STREAM: SSE流开始

    loop 流式事件处理
        STREAM->>PROCESS: message_start事件
        Note over PROCESS: 初始化消息追踪, 获取usage

        STREAM->>PROCESS: content_block_start事件
        Note over PROCESS: 记录block类型(text/tool_use/thinking)

        STREAM->>PROCESS: content_block_delta事件
        Note over PROCESS: text: 累积文本内容
        Note over PROCESS: input_json_delta: 累积工具输入
        Note over PROCESS: thinking_delta: 累积思考内容

        STREAM->>PROCESS: content_block_stop事件
        Note over PROCESS: 完成content block解析

        STREAM->>PROCESS: message_delta事件
        Note over PROCESS: 更新usage统计和费用

        STREAM->>PROCESS: message_stop事件
        Note over PROCESS: 完成消息, 记录最终usage

        PROCESS->>QL: yield 消息更新
    end

    PROCESS->>QL: 流式响应完成
```

## 上下文压缩流程

```mermaid
flowchart TD
    START["queryLoop 开始"] --> CHECK_LEN{"消息长度检查"}

    CHECK_LEN -->|"超过阈值"| SNIP["snipCompactIfNeeded()<br/>基于规则的裁剪"]
    SNIP --> MICRO

    CHECK_LEN -->|"未超过"| MICRO{"微压缩检查"}

    MICRO -->|"需要"| MICRO_COMP["microcompactMessages()<br/>移除冗余细节"]
    MICRO_COMP --> COLLAPSE

    MICRO -->|"不需要"| COLLAPSE{"上下文折叠检查<br/>feature(CONTEXT_COLLAPSE)"}

    COLLAPSE -->|"启用"| COLLAPSE_APPLY["contextCollapse.applyCollapsesIfNeeded()<br/>折叠重复/过期内容"]
    COLLAPSE_APPLY --> AUTO

    COLLAPSE -->|"禁用"| AUTO{"自动压缩检查"}

    AUTO -->|"需要"| AUTO_COMP["autoCompactIfNeeded()<br/>智能摘要压缩<br/>保留关键信息"]
    AUTO_COMP --> CALL_MODEL

    AUTO -->|"不需要"| CALL_MODEL["调用API模型"]

    CALL_MODEL --> RESULT["处理响应"]
    RESULT --> LOOP_BACK{"有工具调用?"}

    LOOP_BACK -->|"有"| TOOL_EXEC["工具执行"]
    TOOL_EXEC --> CHECK_LEN

    LOOP_BACK -->|"无"| END["对话完成"]
```

## 命令处理流程

```mermaid
sequenceDiagram
    participant User as 用户
    participant REPL as REPL.tsx
    participant PROCESS as processUserInput
    participant CMD as 命令系统
    participant QE as QueryEngine

    User->>REPL: 输入 /commit 或其他斜杠命令

    REPL->>PROCESS: processUserInput()

    PROCESS->>PROCESS: 检测斜杠命令前缀 /

    alt 命令存在
        PROCESS->>CMD: 执行命令
        Note over CMD: 命令在 src/commands/ 中定义

        alt 命令返回工具调用
            CMD->>QE: 作为工具结果插入对话
            QE->>User: 继续对话循环
        else 命令直接输出
            CMD->>User: 显示命令输出
        end
    else 命令不存在
        PROCESS->->>QE: 作为普通消息发送
    end
```

## 从用户输入到最终输出的完整流程

```mermaid
flowchart TD
    subgraph 用户交互
        A1["用户在终端输入消息"] --> A2["PromptInput 接收输入"]
        A2 --> A3{"是否斜杠命令?"}
        A3 -->|"是"| A4["processUserInput 解析命令"]
        A3 -->|"否"| A5["构建 UserMessage"]
    end

    subgraph 消息处理
        A4 --> B1["命令执行/转换"]
        A5 --> B1
        B1 --> B2["附加附件信息"]
        B2 --> B3["添加到 mutableMessages"]
    end

    subgraph 查询准备
        B3 --> C1["构建系统提示词<br/>getSystemContext + getUserContext"]
        C1 --> C2["加载工具池<br/>assembleToolPool"]
        C2 --> C3["加载技能和插件"]
        C3 --> C4["应用压缩策略<br/>snip/micro/auto"]
        C4 --> C5["构建API请求参数<br/>normalizeMessages + buildSystemPromptBlocks"]
    end

    subgraph API调用与响应
        C5 --> D1["queryModelWithStreaming<br/>发送到 Anthropic API"]
        D1 --> D2["处理流式响应<br/>text/tool_use/thinking blocks"]
        D2 --> D3{"包含工具调用?"}
    end

    subgraph 工具执行循环
        D3 -->|"是"| E1["StreamingToolExecutor<br/>管理并发工具执行"]
        E1 --> E2["权限检查 canUseTool"]
        E2 --> E3{"需要用户审批?"}
        E3 -->|"是"| E4["PermissionRequest UI"]
        E4 --> E5{"用户允许?"}
        E5 -->|"是"| E6["tool.call() 执行"]
        E5 -->|"否"| E7["返回拒绝消息"]
        E3 -->|"否"| E6
        E6 --> E8["ToolResult 处理"]
        E7 --> E8
        E8 --> E9["构建工具结果消息"]
        E9 --> E10["添加到 mutableMessages"]
        E10 --> C4
    end

    subgraph 结果渲染
        D3 -->|"否"| F1["最终文本回复"]
        E8 -->|"所有工具完成"| F2["递归结果"]
        F1 --> F3["更新 AppState"]
        F2 --> F3
        F3 --> F4["Messages 组件渲染"]
        F4 --> F5["VirtualMessageList<br/>虚拟滚动列表"]
        F5 --> F6["MessageRow 渲染<br/>各种block类型"]
        F6 --> F7["终端输出显示"]
    end
```