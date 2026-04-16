# 接口使用说明

## 作用

本文档用于补充说明当前项目的鉴权方式、统一返回特征和容易误判的接口行为。
正式接口契约以 [openapi.yaml](./openapi.yaml) 为准，本文档不替代 OpenAPI。

## 推荐阅读顺序

1. 先读 `docs/openapi/openapi.yaml`
2. 再读本文档
3. 如需核对实现细节，再回到 `src/modules/*` 对应的 controller、service、presenter

## 当前接口模块

- `应用`：基础探活接口
- `认证`：验证码、登录、刷新、登出、当前用户
- `用户`：用户增删改查
- `文件`：文件上传、文件元数据查询、文件内容读取

## 鉴权体系

当前项目使用 `JWT + Redis 会话`，不是纯无状态 JWT。

- `GET /auth/captcha`：生成一次性 SVG 登录验证码
- `accessToken`：用于访问受保护接口
- `refreshToken`：用于刷新 token 对
- Redis：用于保存登录会话和验证码记录

这意味着：

- `accessToken` 即使未过期，只要 Redis 会话失效，也会被判定为未登录
- `GET /auth/captcha`、`POST /auth/login` 和 `POST /auth/refresh` 是公开接口
- 除公开接口外，其余接口默认都需要 `Authorization: Bearer <accessToken>`
- `POST /auth/logout` 会删除当前会话

## 登录验证码

当前登录流程要求先调用 `GET /auth/captcha`，再调用 `POST /auth/login`。

登录请求体新增：

- `captchaId`：验证码标识
- `captchaCode`：用户输入的验证码文本

约束：

- 验证码保存在 Redis，默认有效期为 `120` 秒
- 验证码仅可使用一次，校验后立即删除
- 验证码比对不区分大小写
- 若生成验证码时记录了请求 IP，则登录时会校验 IP 是否一致

## 统一返回特征

### 1. 没有全局响应包装

当前项目没有统一的 `{ code, message, data }` 包装层。
控制器通常直接返回业务对象，因此前端和 AI 必须以 OpenAPI 中定义的响应体为准。

### 2. 列表接口统一分页结构

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

```json
{
  "success": true
}
```

## 文件接口特别说明

文件模块有两类接口：

- 文件元数据接口：返回 JSON
- 文件内容接口：返回流

重点注意：

- `GET /files/{id}` 返回文件元数据
- `GET /files/{id}/content` 返回文件二进制流，不是 JSON
- `previewUrl` / `downloadUrl` 是相对路径，不一定是完整 URL
- `mode=preview` 倾向于浏览器内联预览
- `mode=download` 强制下载

此外，`isPublic` 目前只是文件元数据字段，不代表该接口可以匿名访问。当前文件相关接口仍然受全局鉴权保护。

## POST 接口状态码

当前控制器没有显式给登录、刷新、登出、上传、创建用户等 POST 接口设置 `@HttpCode()`，因此这些接口在 NestJS 下默认返回 `201`。

## 错误响应理解

当前项目使用 NestJS 默认异常格式，常见结构为：

```json
{
  "statusCode": 401,
  "message": "登录状态无效。",
  "error": "Unauthorized"
}
```

说明：

- `message` 在实际运行时可能是字符串，也可能是字符串数组
- `401` 可能表示 token 缺失、token 过期、格式错误、Redis 会话失效或验证码校验失败
- `503` 往往表示依赖能力不可用，例如 Redis 或 MinIO 未启用

## 给 AI 的使用约束

如果 AI 在别的项目里消费本接口，建议固定遵守下面的顺序：

1. 先读 `docs/openapi/openapi.yaml`
2. 严格按 schema 和 response 编写请求代码
3. 遇到鉴权、分页、文件流或验证码问题时，再读本文档
4. 不要自行猜测返回字段或响应包装格式

## 文档维护约定

当后端接口发生变化时，应同时更新：

- `paths/*.yaml`
- 对应模块的 `components/schemas/*.yaml`
- 如有公共变化，再同步更新 `components/responses/common.yaml` 或 `components/parameters/common.yaml`
- 如行为层面变化较大，再同步更新本文档
