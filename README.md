# Task Harness

Claude Code 任务管理系统，支持 per-task `.claude/` 目录、Skills/Hooks/Rules 管理、以及 OpenSpec 集成。

## 快速开始

### 安装依赖

```bash
cd harness
npm install
```

### 初始化工作区

```bash
./bin/th.js init
```

### 创建任务

```bash
./bin/th.js new "My Feature"
```

### 激活任务

```bash
./bin/th.js activate task-001
```

## 命令

### 工作区
```bash
th init              # 初始化工作区
```

### 任务
```bash
th new <name>       # 创建新任务
th list             # 列出所有任务
th status [id]      # 查看任务状态
th activate <id>     # 激活任务 (生成 .claude/)
```

### Skills
```bash
th skill add <name>              # 创建技能
th skill list                    # 列出所有技能
th skill link <id> [task-id]    # 绑定技能到任务
th skill unlink <id> [task-id]  # 解绑技能
```

### Hooks
```bash
th hook add <name> <type> --command <cmd>  # 创建钩子
th hook list                            # 列出所有钩子
th hook link <id> [task-id]           # 绑定钩子到任务
th hook unlink <id> [task-id]         # 解绑钩子
```

**Hook 类型**: `PreToolUse`, `PostToolUse`, `Stop`

## 示例

```bash
# 初始化
th init

# 创建技能和钩子
th skill add tdd --description "Test-driven development"
th hook add format PostToolUse --command "prettier --write" --matcher "Write|Edit"

# 创建任务并绑定
th new "API Feature"
th skill link tdd task-001
th hook link format task-001
th activate task-001
```

## 文件结构

```
harness/
├── tasks/
│   └── task-001/
│       ├── .claude/
│       │   ├── settings.json  # Claude hooks 配置
│       │   └── skills/       # 技能内容
│       ├── src/               # 任务代码
│       └── task.yaml          # 任务元数据
├── library/
│   ├── skills/               # 共享技能库
│   ├── hooks/                # 共享钩子库
│   └── rules/                # 共享规则库
└── harness.yaml              # 工作区配置
```

## 任务元数据 (task.yaml)

```yaml
id: task-001
name: My Feature
status: paused
skills:
  - skill: tdd
    version: "1.0"
    enabled: true
hooks:
  PostToolUse:
    - format
rules: []
```

## 开发

```bash
# 开发模式 (tsx watch)
npm run dev

# 类型检查
npm run typecheck
```

## 计划

- [x] Phase 1: 基础 CLI 和任务管理
- [x] Phase 2: Skills/Hooks/Rules 管理
- [ ] Phase 3: OpenSpec 集成
- [ ] Phase 4: 24*7 tmux 会话
- [ ] Phase 5: Supervisor (自动修复)

详见 [PLAN.md](./PLAN.md)
