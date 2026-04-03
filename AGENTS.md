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
