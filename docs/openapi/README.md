# OpenAPI 文档说明

- 统一入口文件：`docs/openapi/openapi.yaml`
- AI 使用说明：`docs/openapi/api-guide.md`
- 路径拆分文件：
  - `paths/app.yaml`
  - `paths/auth.yaml`
  - `paths/user.yaml`
  - `paths/file.yaml`
- 可复用组件：
  - `components/schemas/*.yaml`
  - `components/responses/common.yaml`
  - `components/parameters/common.yaml`

说明：

- 其他项目、工具或 AI 代理应优先读取根入口 `openapi.yaml`，不要直接把拆分文件当成主入口。
- `api-guide.md` 是补充阅读说明，用来帮助 AI 更快理解鉴权、分页、文件流等约定；正式契约仍以 OpenAPI 为准。
- 当前大多数接口受全局 JWT 守卫保护。
- 公开接口通过 `security: []` 单独放行。
- `GET /files/{id}/content` 返回二进制文件流，不是 JSON。
