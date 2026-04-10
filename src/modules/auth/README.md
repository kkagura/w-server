# Auth 模块鉴权方案

## 目标

- 用户通过登录接口获取 token
- 访问其它业务接口时必须携带 token
- 服务端统一校验 token，未通过则拒绝访问
- 为后续登出、单点登录、权限扩展预留能力

## 推荐方案

采用 `JWT access token + Redis 会话` 的组合方案。

- `accessToken` 用于访问业务接口
- `refreshToken` 用于刷新 access token
- Redis 用于保存刷新会话、登出状态和可选的黑名单数据

这套方案比单一长效 token 更适合服务端项目，兼顾性能、可控失效和后续扩展。

## 接口设计

### 1. 登录接口

- 路径：`POST /auth/login`
- 请求体：

```json
{
  "username": "admin",
  "password": "123456"
}
```

- 返回体：

```json
{
  "accessToken": "xxx",
  "refreshToken": "xxx",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "user": {
    "id": 1,
    "username": "admin",
    "nickname": "管理员"
  }
}
```

### 2. 刷新 token 接口

- 路径：`POST /auth/refresh`
- 请求体：

```json
{
  "refreshToken": "xxx"
}
```

- 作用：在 access token 过期后，用 refresh token 换取新的 access token

### 3. 登出接口

- 路径：`POST /auth/logout`
- 请求头：`Authorization: Bearer <accessToken>`
- 作用：删除当前会话，必要时将当前 access token 加入黑名单直到过期

## token 设计

### accessToken

- 格式：JWT
- 建议有效期：`15m`
- 用途：访问受保护接口
- 建议载荷：
  - `sub`：用户 ID
  - `username`：用户名
  - `sessionId`：当前登录会话 ID
  - `tokenVersion`：token 版本号
  - `iat` / `exp`：签发和过期时间

### refreshToken

- 格式：随机字符串或独立 JWT
- 建议有效期：`7d`
- 用途：刷新 access token
- 服务端保存到 Redis，支持主动失效

## 鉴权流程

### 登录流程

1. 客户端调用 `POST /auth/login`
2. 服务端根据 `username` 查询用户
3. 使用密码哈希算法校验密码
4. 校验用户状态是否可登录，例如 `status === 1`
5. 生成 `sessionId`
6. 签发 `accessToken`
7. 生成 `refreshToken`
8. 将刷新会话写入 Redis
9. 更新用户最近登录时间和登录 IP
10. 返回 token 信息和脱敏后的用户信息

### 访问受保护接口流程

1. 客户端在请求头中携带 `Authorization: Bearer <accessToken>`
2. 全局 Guard 从请求头提取 token
3. 校验 JWT 签名、过期时间和必要载荷
4. 校验用户是否存在、是否被禁用
5. 可选校验 Redis 中对应会话是否有效
6. 校验通过后将用户信息挂载到请求上下文
7. Controller / Service 继续处理业务

### 刷新流程

1. 客户端调用 `POST /auth/refresh`
2. 服务端解析并校验 refresh token
3. 到 Redis 查找对应会话
4. 若会话有效，则签发新的 access token
5. 建议同时轮换 refresh token
6. 更新 Redis 中的 refresh 会话

### 登出流程

1. 客户端调用 `POST /auth/logout`
2. 服务端根据当前 token 解析出 `userId` 和 `sessionId`
3. 删除 Redis 中对应的 refresh 会话
4. 如需立即失效当前 access token，可把 token 的 `jti` 写入 Redis 黑名单，TTL 设置为 token 剩余有效期

## Redis 键设计

- `auth:refresh:{userId}:{sessionId}`
  - 保存 refresh token 会话信息
  - TTL 为 refresh token 的有效期
- `auth:blacklist:{jti}`
  - 保存已失效 access token 的黑名单记录
  - TTL 为 access token 剩余有效期
- `auth:login-fail:{username}`
  - 保存登录失败次数
  - 用于防暴力破解

## NestJS 模块结构建议

建议未来在 `src/modules/auth/` 下增加以下文件：

- `auth.module.ts`
- `auth.controller.ts`
- `auth.service.ts`
- `jwt.strategy.ts`
- `guards/jwt-auth.guard.ts`
- `decorators/public.decorator.ts`
- `decorators/current-user.decorator.ts`
- `dto/login.dto.ts`
- `dto/refresh-token.dto.ts`

## 守卫策略

- 默认所有接口都需要鉴权
- 仅 `login`、`refresh`、健康检查等接口使用 `@Public()` 放行
- 通过全局 `APP_GUARD` 注册 JWT Guard

这样可以避免遗漏某个接口没有加守卫。

## 配置建议

建议增加 `auth` 配置域：

```yml
auth:
  accessTokenSecret: your-access-secret
  accessTokenExpiresIn: 15m
  refreshTokenSecret: your-refresh-secret
  refreshTokenExpiresIn: 7d
  issuer: w-server
  audience: w-server-client
  singleLogin: false
```

## 安全要求

- 密码不得明文存储，必须使用 `bcrypt` 或 `argon2`
- 登录接口必须限制失败次数和频率
- 用户信息返回时必须脱敏，不能返回 `password`、`salt`
- `status != 1` 的用户禁止登录和访问业务接口
- token 密钥只允许放在配置或环境变量中，不能写死在代码里

## 返回用户信息建议

登录成功后返回脱敏用户对象：

```json
{
  "id": 1,
  "username": "admin",
  "nickname": "管理员",
  "email": "admin@example.com",
  "mobile": "138****0000",
  "avatar": ""
}
```

不要返回以下字段：

- `password`
- `salt`
- 其它敏感内部字段

## 后续扩展方向

- 基于角色的权限控制 `RBAC`
- 基于按钮/资源的细粒度权限
- 单点登录控制
- 多端登录控制
- 操作审计日志
- 二次验证，例如短信或验证码
