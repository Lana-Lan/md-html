# Claude Code 工具系统与状态管理
change 
## 工具系统架构

### 工具接口定义

```mermaid
classDiagram
    class Tool {
        +string name
        +string searchHint
        +ZodSchema inputSchema
        +ZodSchema outputSchema
        +number maxResultSizeChars
        +call(args, context, canUseTool, parentMessage, onProgress) ToolResult
        +description(input, options) string
        +prompt(options) string
        +isEnabled() boolean
        +isConcurrencySafe(input) boolean
        +isReadOnly(input) boolean
        +isDestructive(input) boolean
        +checkPermissions(input, context) PermissionResult
        +validateInput(input, context) ValidationResult
        +getPath(input) string
        +renderToolUseMessage(input, options) ReactElement
        +renderToolResultMessage(content, progressMessages, options) ReactElement
        +renderToolUseProgressMessage(progressMessages, options) ReactElement
    }

    class ToolResult {
        +Output data
        +Message[] newMessages
        +ContextModifier contextModifier
    }

    class buildTool {
        +buildTool~D~(def) Tool~D~
    }

    class findToolByName {
        +findToolByName(tools, name) Tool|null
    }

    class toolMatchesName {
        +toolMatchesName(tool, name) boolean
    }

    Tool --> ToolResult : returns
    buildTool --> Tool : creates
    findToolByName --> Tool : finds
    toolMatchesName --> Tool : checks
```

### 工具注册与发现流程

```mermaid
flowchart TD
    subgraph 工具注册
        A1["getAllBaseTools()<br/>获取所有内置工具"] --> A2["filterByEnvironment()<br/>过滤条件性工具<br/>(feature flags, env vars)"]
        A2 --> A3["getTools(permissionContext)<br/>按权限过滤"]
    end

    subgraph MCP工具
        B1["mcpClients<br/>MCP服务器连接"] --> B2["mcp.tools<br/>MCP工具列表"]
        B1 --> B3["mcp.commands<br/>MCP命令列表"]
        B1 --> B4["mcp.resources<br/>MCP资源列表"]
    end

    subgraph 工具池组装
        A3 --> C1["assembleToolPool()<br/>合并内置+MCP工具"]
        B2 --> C1
        B4 --> C2["ListMcpResourcesTool<br/>ReadMcpResourceTool"]
        B3 --> C3["MCPTool<br/>McpAuthTool"]
        C2 --> C1
        C3 --> C1
        C1 --> C4["filterToolsByDenyRules()<br/>按deny规则过滤"]
        C4 --> C5["最终工具池<br/>去重(内置优先)"]
    end

    C5 --> D["传递给 QueryEngine"]
    C5 --> E["传递给 API 请求构建"]
    C5 --> F["传递给 StreamingToolExecutor"]
```

### 工具分类与全景

```mermaid
graph TB
    subgraph 文件操作工具
        FR["FileReadTool<br/>读取文件内容"]
        FE["FileEditTool<br/>编辑文件(精确替换)"]
        FW["FileWriteTool<br/>写入/创建文件"]
        GL["GlobTool<br/>按模式搜索文件"]
        GR["GrepTool<br/>搜索文件内容"]
        NB["NotebookEditTool<br/>编辑Jupyter notebook"]
    end

    subgraph 执行工具
        BASH["BashTool<br/>执行shell命令"]
        PS["PowerShellTool<br/>执行PowerShell命令"]
        REPL_T["REPLTool<br/>沙箱REPL执行"]
        MON["MonitorTool<br/>监控命令输出"]
    end

    subgraph 网络工具
        WS["WebSearchTool<br/>网络搜索"]
        WF["WebFetchTool<br/>获取网页内容"]
    end

    subgraph 任务管理工具
        TC["TaskCreateTool<br/>创建任务"]
        TG["TaskGetTool<br/>获取任务详情"]
        TU["TaskUpdateTool<br/>更新任务状态"]
        TL["TaskListTool<br/>列出所有任务"]
        TS["TaskStopTool<br/>停止后台任务"]
        TO["TaskOutputTool<br/>获取任务输出"]
        TW["TodoWriteTool<br/>管理Todo列表"]
    end

    subgraph 交互工具
        AQ["AskUserQuestionTool<br/>向用户提问"]
        EPM["EnterPlanModeTool<br/>进入计划模式"]
        XPM["ExitPlanModeTool<br/>退出计划模式"]
        EWT["EnterWorktreeTool<br/>创建git worktree"]
        XWT["ExitWorktreeTool<br/>退出worktree"]
    end

    subgraph Agent/团队工具
        AGT["AgentTool<br/>生成子Agent"]
        TC2["TeamCreateTool<br/>创建Agent团队"]
        TD2["TeamDeleteTool<br/>删除Agent团队"]
        SM["SendMessageTool<br/>团队内通信"]
    end

    subgraph 调度工具
        CC["CronCreateTool<br/>创建定时任务"]
        CD["CronDeleteTool<br/>删除定时任务"]
        CL["CronListTool<br/>列出定时任务"]
    end

    subgraph 其他工具
        SK["SkillTool<br/>执行技能/斜杠命令"]
        CFG["ConfigTool<br/>配置设置"]
        BF["BriefTool<br/>生成摘要"]
        SL["SleepTool<br/>等待延迟"]
        PN["PushNotificationTool<br/>推送通知"]
        RT["RemoteTriggerTool<br/>远程触发器"]
    end

    subgraph MCP工具
        MRP["ListMcpResourcesTool"]
        MRD["ReadMcpResourceTool"]
        MCP_T["MCPTool<br/>通用MCP工具"]
        MA["McpAuthTool<br/>MCP认证"]
    end

    subgraph 条件性工具(feature-gated)
        VP["VerifyPlanExecutionTool<br/>CLAUDE_CODE_VERIFY_PLAN"]
        OT["OverflowTestTool<br/>OVERFLOW_TEST_TOOL"]
        CI["CtxInspectTool<br/>CONTEXT_COLLAPSE"]
        TC3["TerminalCaptureTool<br/>TERMINAL_PANEL"]
        WB["WebBrowserTool<br/>WEB_BROWSER_TOOL"]
        SUF["SendUserFileTool<br/>KAIROS"]
        WF2["WorkflowTool<br/>WORKFLOW_SCRIPTS"]
        LP["ListPeersTool<br/>UDS_INBOX"]
    end
```

### 工具执行并发管理

```mermaid
flowchart TD
    START["queryLoop 提取 tool_use blocks"] --> STE["StreamingToolExecutor<br/>管理工具并发执行"]

    STE --> ADD["addTool(toolUseBlock)<br/>添加到执行队列"]

    ADD --> CHECK{"isConcurrencySafe?<br/>可与其他工具并行?"}

    CHECK -->|"是"| PARALLEL["并行执行<br/>processQueue() 并发调度"]
    CHECK -->|"否"| SERIAL["串行执行<br/>等待前序完成"]

    PARALLEL --> PERM["权限检查 canUseTool"]
    SERIAL --> PERM

    PERM --> APPROVED{"权限状态"}

    APPROVED -->|"自动允许"| EXEC["tool.call()"]
    APPROVED -->|"需要审批"| UI["PermissionRequest UI"]
    APPROVED -->|"拒绝"| REJECT["返回拒绝消息"]

    UI --> USER_APPROVE{"用户确认"}
    USER_APPROVE -->|"允许"| EXEC
    USER_APPROVE -->|"拒绝"| REJECT

    EXEC --> PROGRESS["onProgress 回调<br/>进度更新"]
    PROGRESS --> RESULT["ToolResult<br/>data + newMessages + contextModifier"]

    RESULT --> SIZE{"结果大小检查"}
    SIZE -->|"超过 maxResultSizeChars"| PERSIST["toolResultStorage<br/>持久化到磁盘"]
    SIZE -->|"在限制内"| KEEP["内存中保留"]

    PERSIST --> ALL_DONE
    KEEP --> ALL_DONE["所有工具完成<br/>getRemainingResults()"]

    REJECT --> ALL_DONE

    ALL_DONE --> NEXT_TURN["递归进入下一轮对话"]
```

## 状态管理架构

### 三层状态体系

```mermaid
graph TB
    subgraph 第一层:模块单例状态
        BS["bootstrap/state.ts<br/>模块级单例 STATE"]
        BS_CONTENT["sessionId<br/>parentSessionId<br/>projectRoot<br/>originalCwd / cwd<br/>meter / counters<br/>eventLogger / tracerProvider<br/>mainLoopModelOverride<br/>lastAPIRequest<br/>cachedClaudeMdContent<br/>isRemoteMode<br/>chromeFlagOverride<br/>sessionBypassPermissionsMode"]
    end

    subgraph 第二层:React响应式状态
        AS["AppState.tsx<br/>AppStateProvider + useAppState"]
        AS_CONTENT["settings<br/>tasks<br/>mcp (clients/tools/commands/resources)<br/>plugins<br/>toolPermissionContext<br/>verbose / mainLoopModel / thinkingEnabled<br/>notifications / elicitation<br/>promptSuggestion / speculation<br/>teamContext / inbox / replContext"]
    end

    subgraph 第三层:上下文构建缓存
        CTX["context.ts<br/>memoized providers"]
        CTX_CONTENT["getSystemContext()<br/>- git status<br/>- system prompt injection<br/><br/>getUserContext()<br/>- CLAUDE.md content<br/>- current date"]
    end

    BS -->|"非React代码访问"| CORE["核心业务逻辑<br/>query.ts, QueryEngine.ts, API层"]
    AS -->|"React组件订阅"| UI["UI层<br/>REPL, Messages, PromptInput"]
    CTX -->|"API调用时构建"| API_REQ["API请求构建<br/>system prompt + user context"]

    CORE --> BS
    UI --> AS
    API_REQ --> CTX

    AS -->|"onChangeAppState"| PERSIST["持久化到 settings.json"]
    BS -->|"getClaudeMdContent"| CTX
```

### AppState Store 机制

```mermaid
flowchart LR
    subgraph Store创建
        CREATE["AppStateProvider<br/>创建 Store<AppState>"] --> INIT["初始状态<br/>settings + tasks + mcp + ..."]
        INIT --> ON_CHANGE["绑定 onChangeAppState<br/>变更回调"]
    end

    subgraph 状态读取
        USE_APP["useAppState(selector)<br/>useSyncExternalStore"] --> SELECT["selector(state)<br/>选择性订阅"]
        SELECT --> RE_RENDER["组件只在selector<br/>结果变化时重渲染"]
    end

    subgraph 状态更新
        SET_APP["useSetAppState()"] --> UPDATE["setState(updater)<br/>不可变更新"]
        UPDATE --> NOTIFY["通知所有 subscribers"]
        NOTIFY --> ON_CHANGE_CB["onChangeAppState 回调"]
        ON_CHANGE_CB --> PERSISTENCE["持久化:<br/>- mainLoopModel → settings<br/>- expandedView → settings<br/>- verbose → settings<br/>- permission mode sync"]
    end

    subgraph 非React访问
        RAW["useAppStateStore()"] --> GET["store.getState()<br/>直接读取"]
        RAW --> SET_RAW["store.setState()<br/>直接更新"]
    end

    CREATE --> USE_APP
    CREATE --> SET_APP
    CREATE --> RAW
```

### onChangeAppState 回调处理链

```mermaid
flowchart TD
    CHANGE["AppState 变更"] --> CB["onChangeAppState(newState, prevState)"]

    CB --> P1{"权限模式变更?"}
    P1 -->|"是"| P1A["通知CCR和SDK<br/>权限模式同步"]

    CB --> P2{"mainLoopModel变更?"}
    P2 -->|"是"| P2A["保存到settings.json<br/>模型持久化"]

    CB --> P3{"expandedView变更?"}
    P3 -->|"是"| P3A["保存到settings.json<br/>视图状态持久化"]

    CB --> P4{"verbose变更?"}
    P4 -->|"是"| P4A["保存到settings.json<br/>verbose标志持久化"]

    CB --> P5{"settings变更?"}
    P5 -->|"是"| P5A["清除认证缓存<br/>重新加载配置"]
```

### CLAUDE.md 发现与加载流程

```mermaid
flowchart TD
    START["getMemoryFiles()"] --> PRIORITY["按优先级加载"]

    PRIORITY --> M1["1. Managed Memory<br/>(Anthropic托管)"]
    PRIORITY --> M2["2. User Memory<br/>(~/.claude/CLAUDE.md)"]
    PRIORITY --> M3["3. Project Memory<br/>(项目根目录 CLAUDE.md)"]
    PRIORITY --> M4["4. Local Memory<br/>(.claude/CLAUDE.md<br/>.claude/rules/*.md)"]

    M1 --> TRAVERSE["遍历CWD向上到根目录<br/>查找所有CLAUDE.md文件"]
    M2 --> TRAVERSE
    M3 --> TRAVERSE
    M4 --> TRAVERSE

    TRAVERSE --> INCLUDE["处理 @include 指令"]
    INCLUDE --> FORMAT["getClaudeMds()<br/>按类型过滤和格式化"]
    FORMAT --> RESULT["MemoryFileInfo[]<br/>path + type + content + globs"]

    RESULT --> CTX["注入到 getUserContext()<br/>作为系统上下文的一部分"]
```

### UI组件与状态连接

```mermaid
graph TB
    subgraph Root Provider层级
        FPS["FpsMetricsProvider"] --> STATS["StatsProvider"] --> APP_STATE["AppStateProvider"]
    end

    subgraph REPL组件树
        APP_STATE --> REPL_COMP["REPL Component"]
        REPL_COMP --> PROMPT_IN["PromptInput"]
        REPL_COMP --> MSG_LIST["Messages"]
        REPL_COMP --> PERM_REQ["PermissionRequest"]
        REPL_COMP --> TOOL_USE["StreamingToolUses"]
    end

    subgraph PromptInput订阅
        PROMPT_IN --> S1["useAppState(s => s.tasks)"]
        PROMPT_IN --> S2["useAppState(s => s.promptSuggestion)"]
        PROMPT_IN --> S3["useAppState(s => s.speculation)"]
        PROMPT_IN --> S4["useAppState(s => s.viewingAgentTaskId)"]
        PROMPT_IN --> S5["useAppState(s => s.thinkingEnabled)"]
        PROMPT_IN --> S6["useAppState(s => s.fastMode)"]
    end

    subgraph Messages渲染流程
        MSG_LIST --> NORM["normalizeMessages()"]
        NORM --> GROUP["applyGrouping()"]
        GROUP --> VLIST["VirtualMessageList<br/>虚拟滚动"]
        VLIST --> ROW["MessageRow"]
        ROW --> BLOCK["各种Block渲染器<br/>TextBlock / ToolUseBlock / ToolResultBlock / ThinkingBlock"]
    end

    subgraph 权限审批流程
        PERM_REQ --> CAN_USE["canUseTool()"]
        CAN_USE --> PERM_CHECK["权限规则检查"]
        PERM_CHECK --> AUTO_ALLOW{"自动允许?"}
        AUTO_ALLOW -->|"是"| EXECUTE["直接执行"]
        AUTO_ALLOW -->|"否"| DIALOG["显示权限对话框"]
        DIALOG --> USER_DECIDE{"用户决定"}
        USER_DECIDE -->|"允许"| EXECUTE
        USER_DECIDE -->|"拒绝"| REJECT["返回拒绝"]
    end

    FPS --> APP_STATE --> REPL_COMP
```

### 状态流向总览

```mermaid
flowchart LR
    subgraph 输入源
        USER_INPUT["用户输入"] --> PROMPT_STATE["PromptInput<br/>更新AppState"]
        CMD_INPUT["斜杠命令"] --> CMD_STATE["命令处理<br/>更新AppState"]
        API_INPUT["API响应"] --> API_STATE["queryLoop<br/>更新AppState"]
    end

    subgraph 状态中枢
        PROMPT_STATE --> APP_STORE["AppState Store<br/>中央响应式状态"]
        CMD_STATE --> APP_STORE
        API_STATE --> APP_STORE
    end

    subgraph 状态消费
        APP_STORE --> UI_RENDER["UI渲染<br/>Messages, PromptInput"]
        APP_STORE --> PERSISTENCE["持久化<br/>settings.json"]
        APP_STORE --> API_BUILD["API请求构建<br/>工具池, 系统提示词"]
        APP_STORE --> NOTIFICATION["通知服务"]
        APP_STORE --> MCP_STATE["MCP状态同步"]
    end

    subgraph Bootstrap状态
        BOOT_STATE["bootstrap/state.ts<br/>模块单例状态"]
        BOOT_STATE --> API_BUILD
        BOOT_STATE --> CTX_BUILD["上下文构建<br/>context.ts"]
    end

    APP_STORE -->|"onChangeAppState"| PERSISTENCE
    CTX_BUILD --> API_BUILD
```