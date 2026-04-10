# File 模块技术方案

## 目标

- 新增独立的 `file` 模块
- 文件二进制内容存储在 MinIO
- 系统内部新建文件表保存元数据和业务关联信息
- 提供统一的文件预览/下载接口
- 文件接口默认接入现有鉴权体系，访问时必须携带 token

## 总体设计

采用 `MinIO 存文件内容 + MySQL 存文件元数据` 的模式。

- MinIO 负责存储实际文件内容
- MySQL 表 `sys_file` 负责记录文件元数据
- 业务系统通过文件 ID 管理文件
- 客户端访问文件时，不直接暴露 MinIO 私有地址
- 服务端负责做权限校验和流式转发

## 模块结构建议

建议未来在 `src/modules/file/` 下增加以下文件：

- `file.module.ts`
- `file.controller.ts`
- `file.service.ts`
- `file.entity.ts`
- `file.presenter.ts`
- `dto/upload-file.dto.ts`
- `dto/query-file.dto.ts`
- `storage/minio.service.ts`
- `storage/minio.types.ts`

## 配置设计

建议新增两个配置域：`minio` 和 `file`

```yml
minio:
  endpoint: 127.0.0.1
  port: 9000
  useSSL: false
  accessKey: minioadmin
  secretKey: minioadmin
  bucket: w-server

file:
  maxSize: 10485760
  previewMimeTypes:
    - image/jpeg
    - image/png
    - image/webp
    - application/pdf
  allowedMimeTypes:
    - image/jpeg
    - image/png
    - image/webp
    - application/pdf
    - application/vnd.openxmlformats-officedocument.wordprocessingml.document
```

说明：

- `minio` 负责对象存储连接配置
- `file.maxSize` 控制单文件上传大小
- `file.previewMimeTypes` 控制可直接预览的文件类型
- `file.allowedMimeTypes` 控制允许上传的文件类型

## 文件表设计

表名建议：`sys_file`

### 字段建议

- `id`：主键，`bigint unsigned`
- `bucket`：MinIO bucket 名
- `object_key`：MinIO 对象路径，唯一
- `original_name`：原始文件名
- `ext`：文件扩展名
- `mime_type`：MIME 类型
- `size`：文件大小，单位字节
- `etag`：MinIO 返回的 ETag
- `sha256`：文件内容摘要，用于去重或校验
- `status`：状态，建议 `0-上传中 1-可用 2-已删除 3-异常`
- `is_public`：是否公开访问，默认 `0`
- `biz_type`：业务类型，例如 `user-avatar`、`contract`
- `biz_id`：业务主键，可空
- `created_by`：上传人 ID
- `create_at`
- `update_by`
- `update_at`
- `delete_at`

### 索引建议

- 唯一索引：`uk_object_key (object_key)`
- 普通索引：`idx_biz (biz_type, biz_id)`
- 普通索引：`idx_created_by (created_by)`
- 普通索引：`idx_status_delete_at (status, delete_at)`

## MinIO 对象路径设计

不要直接使用用户原始文件名作为对象 key。建议格式：

```text
{bizType}/{yyyy}/{MM}/{dd}/{uuid}.{ext}
```

示例：

```text
user-avatar/2026/04/10/550e8400-e29b-41d4-a716-446655440000.png
```

这样做的好处：

- 避免文件重名冲突
- 路径结构清晰，便于排查
- 不暴露真实文件命名规则

## 接口设计

### 1. 上传文件

- 路径：`POST /files/upload`
- 类型：`multipart/form-data`
- 参数：
  - `file`
  - `bizType` 可选
  - `bizId` 可选

作用：

- 上传文件到 MinIO
- 写入 `sys_file` 元数据记录
- 返回文件 ID 和相关元数据

### 2. 查询文件详情

- 路径：`GET /files/:id`

作用：

- 返回文件元数据
- 不返回 MinIO 密钥等敏感配置

### 3. 预览或下载文件

- 路径：`GET /files/:id/content?mode=preview|download`

作用：

- `mode=preview` 时优先使用 `inline`
- `mode=download` 时强制使用 `attachment`
- 服务端做权限校验后，从 MinIO 获取文件流并转发给客户端

### 4. 分页查询文件列表

- 路径：`GET /files`

支持条件：

- `bizType`
- `bizId`
- `originalName`

### 5. 删除文件

- 路径：`DELETE /files/:id`

建议：

- 默认逻辑删除数据库记录
- 可选择同步删除 MinIO 对象
- 或先标记删除，再异步清理对象

## 上传流程

建议流程如下：

1. 客户端携带 token 调用 `POST /files/upload`
2. 服务端校验文件大小、类型、扩展名
3. 生成 `objectKey`
4. 将文件流上传到 MinIO
5. 获取上传结果中的 `etag`
6. 写入 `sys_file`
7. 返回上传结果

### 一致性处理

由于数据库和 MinIO 不是同一个事务，建议采用补偿机制：

- 如果 MinIO 上传成功但数据库写入失败，立即尝试删除 MinIO 对象
- 不做分布式事务，当前场景用补偿逻辑更合适

## 预览/下载流程

建议统一走：

- `GET /files/:id/content?mode=preview`
- `GET /files/:id/content?mode=download`

服务端处理流程：

1. 根据 `id` 查询 `sys_file`
2. 校验记录存在、未删除、状态可用
3. 校验当前用户是否有访问权限
4. 从 MinIO 获取对象流
5. 设置响应头
6. 将文件流直接返回给客户端

### 响应头建议

- `Content-Type`
- `Content-Length`
- `ETag`
- `Content-Disposition`

其中：

- 预览模式：`Content-Disposition: inline`
- 下载模式：`Content-Disposition: attachment`

建议使用 RFC 5987 方式处理中文文件名：

```text
filename*=UTF-8''...
```

## 权限设计

建议接入当前系统已有的 token 鉴权机制：

- 默认所有文件接口都需要登录
- 通过 token 获取当前用户信息
- 文件记录中保存 `created_by`
- 第一阶段可先实现“登录用户可访问系统文件”
- 后续再扩展为“仅本人可访问”或“按业务对象权限访问”

如果未来需要公开文件访问，可以增加：

- `is_public = 1`
- 单独的公开只读接口

## 可预览文件类型建议

第一阶段建议只支持浏览器天然支持的类型：

- `image/*`
- `application/pdf`
- `text/plain`

其它类型即使传 `mode=preview`，也建议退化为下载。

## 删除策略建议

建议优先做逻辑删除：

- 数据库记录保留
- `status` 改为已删除
- `delete_at` 写入时间

后续可根据业务需要再做：

- 立即删除 MinIO 对象
- 延迟清理任务
- 回收站机制

## 后续扩展方向

- SHA256 去重上传
- 图片缩略图
- 批量上传
- 大文件分片上传
- MinIO 预签名 URL
- Range 断点预览
- 文件访问审计日志

## 推荐实现顺序

建议按以下顺序落地：

1. 增加 `minio` / `file` 配置
2. 新建 `sys_file` 表迁移和 `file.entity.ts`
3. 封装 `MinioService`
4. 实现上传接口
5. 实现文件详情和分页列表
6. 实现预览/下载接口
7. 实现删除逻辑
8. 补齐单测和 e2e 测试
