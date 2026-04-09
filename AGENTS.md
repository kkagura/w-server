# 项目说明

## 项目概览

- 项目名称：`w-server`
- 项目类型：基于 NestJS 的服务端应用
- 语言：TypeScript
- 包管理器：`pnpm`
- 运行平台：Node.js

当前项目是一个较为精简的 NestJS 服务端工程，适合作为接口服务、业务后台服务或后续微服务拆分前的基础骨架。

## 技术栈

- `@nestjs/common`
- `@nestjs/core`
- `@nestjs/platform-express`
- `@nestjs/config`
- `yaml`
- `jest`
- `eslint`
- `prettier`

## 目录结构

```text
.
├─ config/                 # YAML 配置文件目录
│  ├─ application.yml      # 基础配置
│  ├─ application.dev.yml  # 开发环境配置
│  ├─ application.test.yml # 测试环境配置
│  └─ application.prod.yml # 生产环境配置
├─ src/
│  ├─ config/
│  │  ├─ config.types.ts   # 配置类型定义
│  │  └─ configuration.ts  # 配置加载、合并与校验逻辑
│  ├─ app.controller.ts
│  ├─ app.module.ts
│  ├─ app.service.ts
│  └─ main.ts              # 应用启动入口
├─ test/                   # e2e 测试
├─ package.json
└─ README.md
```

## 常用命令

- 安装依赖：`pnpm install`
- 开发启动：`pnpm run start:dev`
- 普通启动：`pnpm run start`
- 生产启动：`pnpm run start:prod`
- 构建：`pnpm run build`
- 单元测试：`pnpm run test`
- e2e 测试：`pnpm run test:e2e`

## 配置文件规则

### 1. 配置文件位置

所有 YAML 配置文件统一放在项目根目录下的 `config/` 目录中。

### 2. 配置文件命名

- `application.yml`：公共基础配置
- `application.dev.yml`：开发环境配置
- `application.test.yml`：测试环境配置
- `application.prod.yml`：生产环境配置

如后续增加新的环境，统一沿用 `application.{env}.yml` 命名规则。

### 3. 环境识别规则

- 通过环境变量 `NODE_ENV` 识别当前环境
- 未显式设置时，默认环境为 `dev`

示例：

```bash
NODE_ENV=dev
NODE_ENV=test
NODE_ENV=prod
```

### 4. 加载顺序

配置加载逻辑位于 `src/config/configuration.ts`，加载顺序如下：

1. 先加载 `config/application.yml`
2. 再加载 `config/application.{NODE_ENV}.yml`
3. 对两个配置对象进行深度合并
4. 环境配置覆盖基础配置中的同名字段

这意味着环境文件只需要写“差异项”，不需要重复整份配置。

### 5. 配置组织方式

配置内容必须采用嵌套结构，按功能域进行聚合，不建议使用大量扁平字段。

推荐写法：

```yml
app:
  name: w-server

server:
  host: 0.0.0.0
  port: 3000
```

不推荐写法：

```yml
appName: w-server
serverPort: 3000
serverHost: 0.0.0.0
```

### 6. 当前已约定的配置项

#### `app`

- `app.name`：应用名称
- `app.env`：运行环境标识，由程序根据 `NODE_ENV` 注入

#### `server`

- `server.host`：服务监听地址
- `server.port`：服务监听端口

### 7. 环境变量覆盖规则

以下环境变量会覆盖 YAML 中对应的配置值：

- `HOST` 覆盖 `server.host`
- `PORT` 覆盖 `server.port`

优先级从高到低如下：

1. 环境变量
2. `application.{env}.yml`
3. `application.yml`
4. 程序内部默认值

### 8. 校验规则

当前项目对部分配置项做了基础校验：

- `server.port` 必须为 `1` 到 `65535` 之间的整数
- YAML 根节点必须是对象结构

如果配置格式错误，应用会在启动阶段直接报错，而不是带着错误配置继续运行。

### 9. 配置变更约定

- 新增配置时，优先放入已有功能分组下
- 如果是新的能力域，再新增新的顶层配置节点，例如 `database`、`redis`、`logger`
- 不要把敏感信息直接硬编码到默认配置中
- 多环境差异仅写入对应的环境配置文件

推荐扩展示例：

```yml
database:
  host: 127.0.0.1
  port: 5432
  username: demo
  password: demo
```

## 开发约定建议

- 新增配置项时，同时补充 `src/config/config.types.ts` 中的类型定义
- 如配置项参与启动逻辑，优先通过 `ConfigService` 读取，不要直接在业务代码中读取 `process.env`
- 保持配置命名语义清晰，避免缩写和含义不明的字段名
- 如后续配置项增加较多，可以按领域拆分为单独的配置服务或配置常量

## 数据库迁移

### 目录结构

```
src/
  └─ migrations/            # TypeORM 迁移文件目录
      └─ {timestamp}-InitialSchema.ts  # 初始迁移（含基础表结构）
  └─ commands/
      └─ db.command.ts      # 数据库迁移 CLI
```

### 环境说明

迁移命令通过 `NODE_ENV` 识别环境，未设置时默认 `dev`。配置文件必须位于 `config/` 目录。

### 常用命令

```bash
# 初始化数据库（创建数据库，仅首次需要）
pnpm db init

# 运行待执行迁移
pnpm db migrate

# 回滚上一次迁移
pnpm db revert

# 同步 schema（根据 Entity 定义建表/修改表，仅 dev/test 可用）
pnpm db sync

# 查看帮助
pnpm db help
```

### 指定环境

通过 `NODE_ENV` 环境变量指定目标环境：

```bash
NODE_ENV=test pnpm db migrate   # 对 test 环境执行迁移
NODE_ENV=prod pnpm db init      # 对 prod 环境初始化数据库
```

### 使用 TypeORM CLI 管理迁移

```bash
# 创建新迁移（需先编写好 Entity）
pnpm typeorm migration:create ./src/migrations/MigrationName

# 生成迁移（根据当前 Entity 与数据库差异自动生成）
pnpm typeorm migration:generate ./src/migrations/MigrationName

# 查看迁移状态
pnpm typeorm migration:show
```

### 迁移文件约定

- 迁移文件统一放在 `src/migrations/` 目录
- 文件命名格式：`{timestamp}-{MigrationName}.ts`
- 每次上线前确保迁移已全部执行
- 项目初始迁移文件 `InitialSchema` 用于建立基础表结构（如 `_version` 版本表），不可删除

### 事务说明

`migrate` 和 `revert` 命令默认以 `transaction: 'all'` 模式运行，即所有迁移在同一事务中执行。任意一个失败则全部自动回滚，确保不会留下部分完成的迁移状态。
