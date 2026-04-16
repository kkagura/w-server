# Auth 模块说明

## 模块职责

`src/modules/auth/` 负责当前项目的登录认证能力，包含：

- SVG 验证码生成
- 用户名密码登录
- JWT accessToken / refreshToken 签发与刷新
- Redis 会话校验
- 当前登录用户解析

## 当前接口

### `GET /auth/captcha`

生成一张 SVG 验证码，并返回：

```json
{
  "captchaId": "uuid",
  "captchaSvg": "<svg>...</svg>",
  "expiresIn": 120
}
```

验证码答案不会明文返回，服务端会把哈希值写入 Redis，默认有效期 `120` 秒。

### `POST /auth/login`

请求体：

```json
{
  "username": "admin",
  "password": "123456",
  "captchaId": "uuid",
  "captchaCode": "aB3d"
}
```

处理流程：

1. 校验 `username`、`password`、`captchaId`、`captchaCode`
2. 从 Redis 读取验证码记录并校验
3. 校验通过后立即删除验证码，避免复用
4. 查询用户并验证密码
5. 校验用户状态
6. 生成 `sessionId`
7. 签发 `accessToken` 与 `refreshToken`
8. 将登录会话写入 Redis
9. 更新用户最后登录时间和 IP

### `POST /auth/refresh`

根据 refreshToken 刷新 token 对，并复用当前会话 `sessionId`。

### `POST /auth/logout`

删除当前 Redis 会话。

### `GET /auth/me`

返回当前登录用户的公开字段和 `sessionId`。

## Redis Key 设计

- `auth:captcha:{captchaId}`
  - 保存验证码答案哈希、生成时 IP、创建时间
  - TTL 为 `auth.captcha.ttlSeconds`
- `auth:session:{sessionId}`
  - 保存 refreshToken 哈希和会话元数据
  - TTL 为 `auth.refreshTokenExpiresIn`

## 配置项

```yml
auth:
  accessTokenSecret: please-change-me-access-token-secret
  accessTokenExpiresIn: 900
  refreshTokenSecret: please-change-me-refresh-token-secret
  refreshTokenExpiresIn: 604800
  issuer: w-server
  audience: w-server-client
  captcha:
    enabled: true
    ttlSeconds: 120
    size: 4
    width: 120
    height: 40
    noise: 2
    ignoreChars: 0Oo1iIlL
    background: '#f7f7f7'
```

## 依赖约束

- Redis 必须启用，否则验证码和登录会话都无法使用
- 验证码基于 `svg-captcha` 生成，前端可直接渲染返回的 `captchaSvg`
- 验证码比较不区分大小写
- 若验证码生成和登录请求 IP 不一致，会判定校验失败
