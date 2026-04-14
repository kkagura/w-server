# 接口使用说明

## 作用

本文件是给开发者和 AI 看的接口使用说明，帮助快速理解本项目的鉴权方式、统一返回格式和一些容易误判的行为。

正式接口契约以 [openapi.yaml](./openapi.yaml) 为准，本文件只是补充说明，不替代 OpenAPI。

## 推荐阅读顺序

1. 先读 `docs/openapi/openapi.yaml`
2. 再读本文件
3. 如果要核对实现细节，再回到 `src/modules/*` 的 controller、service、presenter

## 当前接口模块

- `应用`：基础探活接口
- `认证`：登录、刷新、登出、当前用户
- `用户`：用户增删改查
- `文件`：文件上传、文件元数据查询、文件内容流式读取

## 鉴权体系

当前项目使用的是“JWT + Redis 会话”方案，不是单纯的无状态 JWT。

- `accessToken`：用于访问受保护接口
- `refreshToken`：用于刷新 token 对
- Redis：用于保存登录会话

这意味着：

- `accessToken` 即使还没过期，只要 Redis 会话失效，也会被判定为未登录
- `POST /auth/login` 和 `POST /auth/refresh` 是公开接口
- 除公开接口外，其余接口默认都需要 `Authorization: Bearer <accessToken>`
- `POST /auth/logout` 会删除当前会话

## 统一返回特点

### 1. 没有全局响应包装器

当前项目没有统一的 `{ code, message, data }` 这一层包装。  
控制器通常直接返回业务对象，因此前端和 AI 必须严格以 OpenAPI 中定义的响应体为准。

### 2. 列表接口统一分页结构

列表查询统一返回：

```json
{
  "list": [],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "total": 0,
    "pageCount": 0
  }
}
```

分页参数约定：

- `page` 默认 `1`
- `pageSize` 默认 `10`
- `pageSize` 最大 `100`

### 3. 删除类接口统一返回

目前删除或登出这类成功结果通常返回：

```json
{
  "success": true
}
```

## 文件接口特别说明

文件模块有两个层面的接口：

- 文件元数据接口：返回 JSON
- 文件内容接口：返回流

重点注意：

- `GET /files/{id}` 返回文件元数据
- `GET /files/{id}/content` 返回文件二进制流，不是 JSON
- `previewUrl` / `downloadUrl` 是相对路径，不一定是完整 URL
- `mode=preview` 倾向于浏览器内联预览
- `mode=download` 强制下载

另外，`isPublic` 目前只是文件元数据字段，不代表该接口可以匿名访问。  
当前文件相关接口依然受全局鉴权保护。

## POST 接口状态码

当前控制器没有显式给登录、刷新、登出、上传、创建用户等 POST 接口设置 `@HttpCode()`，因此这些接口在 NestJS 下默认返回 `201`。

如果前端或 AI 默认把它们当成 `200`，容易在联调时产生误判。

## 错误响应理解

当前项目使用的是 NestJS 默认异常格式，常见结构为：

```json
{
  "statusCode": 401,
  "message": "登录状态无效。",
  "error": "Unauthorized"
}
```

说明：

- `message` 在实际运行时可能是字符串，也可能是字符串数组
- 401 既可能是 token 缺失，也可能是 token 过期、格式错误、Redis 会话失效
- 503 往往表示依赖能力不可用，例如 Redis 或 MinIO 未启用

## 给 AI 的使用约束

如果 AI 在另一个项目里消费本接口，建议固定遵守下面的顺序：

1. 先读取 `docs/openapi/openapi.yaml`
2. 严格按 schema 和 response 编写请求代码
3. 遇到鉴权、分页、文件流问题时，再读取本文件
4. 不允许自行猜测返回字段或响应包装格式

## 文档维护约定

当后端接口发生变化时，应同时更新以下内容：

- `paths/*.yaml`
- 对应模块的 `components/schemas/*.yaml`
- 如有公共变化，再同步更新 `components/responses/common.yaml` 或 `components/parameters/common.yaml`
- 如果行为层面变化较大，还应同步更新本文件

如果代码已改但 OpenAPI 和本说明未更新，应视为任务未完成。
