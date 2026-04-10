# API 文档

## 基础信息

- **Base URL**: `http://localhost:3001/api`
- **认证方式**: JWT Bearer Token
- **响应格式**: JSON

## 认证相关

### 用户注册
```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "string",
  "email": "string",
  "password": "string"
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "username": "string",
      "email": "string",
      "createdAt": "ISO8601"
    },
    "token": "jwt-token"
  }
}
```

### 用户登录
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "string",
  "password": "string"
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "username": "string",
      "email": "string"
    },
    "token": "jwt-token"
  }
}
```

### 获取用户信息
```http
GET /api/auth/profile
Authorization: Bearer {token}
```

## 账户管理

### 获取账户列表
```http
GET /api/accounts
Authorization: Bearer {token}
```

**Query参数**:
- `type`: 账户类型 (asset|liability|equity|income|expense)
- `page`: 页码 (默认1)
- `limit`: 每页数量 (默认10)

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "现金",
      "accountType": "asset",
      "balance": 1000.00,
      "currency": "CNY",
      "isActive": true
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPages": 3
  }
}
```

### 创建账户
```http
POST /api/accounts
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "银行存款",
  "accountType": "asset",
  "subjectId": "uuid",
  "currency": "CNY"
}
```

### 获取账户详情
```http
GET /api/accounts/{id}
Authorization: Bearer {token}
```

### 更新账户
```http
PUT /api/accounts/{id}
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "银行存款-工行",
  "isActive": true
}
```

### 删除账户
```http
DELETE /api/accounts/{id}
Authorization: Bearer {token}
```

### 获取账户余额
```http
GET /api/accounts/{id}/balance
Authorization: Bearer {token}
```

## 交易管理

### 获取交易列表
```http
GET /api/transactions
Authorization: Bearer {token}
```

**Query参数**:
- `startDate`: 开始日期 (ISO8601)
- `endDate`: 结束日期 (ISO8601)
- `status`: 交易状态 (draft|posted|void)
- `page`: 页码
- `limit`: 每页数量

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "transactionDate": "2024-01-15",
      "description": "购买办公用品",
      "referenceNo": "TXN20240115001",
      "status": "posted",
      "entries": [
        {
          "id": "uuid",
          "accountId": "uuid",
          "entryType": "debit",
          "amount": 500.00,
          "description": "办公用品采购"
        },
        {
          "id": "uuid",
          "accountId": "uuid",
          "entryType": "credit",
          "amount": 500.00,
          "description": "银行支付"
        }
      ]
    }
  ]
}
```

### 创建交易
```http
POST /api/transactions
Authorization: Bearer {token}
Content-Type: application/json

{
  "transactionDate": "2024-01-15",
  "description": "购买办公用品",
  "referenceNo": "TXN20240115001",
  "entries": [
    {
      "accountId": "uuid",
      "entryType": "debit",
      "amount": 500.00,
      "description": "办公用品采购"
    },
    {
      "accountId": "uuid",
      "entryType": "credit",
      "amount": 500.00,
      "description": "银行支付"
    }
  ]
}
```

**验证规则**:
- 借方总金额必须等于贷方总金额
- 每笔交易至少包含两个分录
- 账户必须存在且有效

### 获取交易详情
```http
GET /api/transactions/{id}
Authorization: Bearer {token}
```

### 更新交易
```http
PUT /api/transactions/{id}
Authorization: Bearer {token}
Content-Type: application/json

{
  "description": "更新后的描述",
  "entries": [...]
}
```

### 删除交易
```http
DELETE /api/transactions/{id}
Authorization: Bearer {token}
```

### 交易过账
```http
POST /api/transactions/{id}/post
Authorization: Bearer {token}
```

### 交易冲销
```http
POST /api/transactions/{id}/void
Authorization: Bearer {token}
```

## 会计科目管理

### 获取科目列表
```http
GET /api/subjects
Authorization: Bearer {token}
```

**Query参数**:
- `type`: 科目类型 (asset|liability|equity|income|expense)

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "code": "1001",
      "name": "现金",
      "subjectType": "asset",
      "description": "库存现金",
      "isSystem": true
    }
  ]
}
```

### 获取科目树
```http
GET /api/subjects/tree
Authorization: Bearer {token}
```

### 获取科目详情
```http
GET /api/subjects/{id}
Authorization: Bearer {token}
```

### 创建科目（仅管理员）
```http
POST /api/subjects
Authorization: Bearer {token}
Content-Type: application/json

{
  "code": "1003",
  "name": "其他货币资金",
  "subjectType": "asset",
  "description": "除现金和银行存款外的货币资金"
}
```

## 财务报表

### 资产负债表
```http
GET /api/reports/balance-sheet
Authorization: Bearer {token}
```

**Query参数**:
- `asOfDate`: 截止日期 (ISO8601)

**响应示例**:
```json
{
  "success": true,
  "data": {
    "asOfDate": "2024-01-15",
    "assets": [
      {
        "accountId": "uuid",
        "accountName": "现金",
        "balance": 1000.00,
        "accountType": "asset"
      }
    ],
    "liabilities": [...],
    "equity": [...],
    "totalAssets": 50000.00,
    "totalLiabilities": 20000.00,
    "totalEquity": 30000.00
  }
}
```

### 损益表
```http
GET /api/reports/income-statement
Authorization: Bearer {token}
```

**Query参数**:
- `startDate`: 开始日期
- `endDate`: 结束日期

**响应示例**:
```json
{
  "success": true,
  "data": {
    "period": {
      "startDate": "2024-01-01",
      "endDate": "2024-01-15"
    },
    "income": [...],
    "expenses": [...],
    "totalIncome": 8000.00,
    "totalExpenses": 3000.00,
    "netIncome": 5000.00
  }
}
```

### 试算平衡表
```http
GET /api/reports/trial-balance
Authorization: Bearer {token}
```

**Query参数**:
- `asOfDate`: 截止日期

### 现金流量表
```http
GET /api/reports/cash-flow
Authorization: Bearer {token}
```

**Query参数**:
- `startDate`: 开始日期
- `endDate`: 结束日期

### 账户明细账
```http
GET /api/reports/account-ledger/{accountId}
Authorization: Bearer {token}
```

**Query参数**:
- `startDate`: 开始日期
- `endDate`: 结束日期

## 数据分析

### 财务概览
```http
GET /api/analytics/overview
Authorization: Bearer {token}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "totalAssets": 50000.00,
    "totalLiabilities": 20000.00,
    "netWorth": 30000.00,
    "monthlyIncome": 8000.00,
    "monthlyExpenses": 3000.00,
    "cashFlow": 5000.00
  }
}
```

### 收支分析
```http
GET /api/analytics/income-expense
Authorization: Bearer {token}
```

**Query参数**:
- `period`: 分析周期 (month|quarter|year)

### 趋势分析
```http
GET /api/analytics/trends
Authorization: Bearer {token}
```

**Query参数**:
- `metric`: 指标类型 (assets|income|expenses)
- `period`: 分析周期

### 账户余额分析
```http
GET /api/analytics/account-balance
Authorization: Bearer {token}
```

## 错误处理

所有错误响应遵循以下格式：

```json
{
  "success": false,
  "error": "错误描述信息",
  "message": "详细错误信息（开发环境）"
}
```

### 常见错误码
- `400` - 请求参数错误
- `401` - 未认证
- `403` - 权限不足
- `404` - 资源不存在
- `422` - 数据验证失败
- `500` - 服务器错误

## 数据验证规则

### 交易验证
- 借贷金额必须相等
- 至少包含两个分录
- 账户必须存在且有效
- 金额必须大于0

### 账户验证
- 账户名称不能为空
- 账户类型必须有效
- 科目关联必须有效

### 金额格式
- 所有金额字段使用数字类型
- 保留两位小数
- 单位：元

## 分页说明

所有列表接口支持分页：

**请求参数**:
- `page`: 页码（从1开始）
- `limit`: 每页数量（默认10，最大100）

**响应格式**:
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10
  }
}
```

## 速率限制

- 认证接口: 5次/分钟
- 查询接口: 60次/分钟
- 写入接口: 20次/分钟

## 版本控制

API版本通过请求头指定：

```http
API-Version: v1
```

当前版本: `v1`