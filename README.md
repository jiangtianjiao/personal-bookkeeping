# 个人复式记账系统

一个基于复式记账原理的个人财务管理工具，使用现代化的技术栈构建。

## 项目概述

个人复式记账系统是一个功能完整的财务管理应用，采用专业的复式记账方法，帮助用户实现精确的财务管理和深度的财务分析。

### 核心特性

- ✅ **复式记账** - 完整的借贷记账法支持，确保账务平衡
- ✅ **账户管理** - 支持资产、负债、权益、收入、费用五大类账户
- ✅ **会计科目** - 预设常用会计科目，支持自定义科目
- ✅ **交易记录** - 完整的交易录入、修改、查询功能
- ✅ **财务报表** - 资产负债表、损益表、现金流量表等
- ✅ **数据可视化** - 直观的图表展示和数据分析
- ✅ **本地存储** - 基于SQLite的本地数据存储

### 技术栈

#### 前端
- **框架**: React 18 + TypeScript
- **构建工具**: Vite 4
- **UI组件**: Ant Design 5
- **状态管理**: Zustand
- **路由**: React Router 6
- **图表**: ECharts
- **HTTP客户端**: Axios

#### 后端
- **框架**: Express.js + TypeScript
- **数据库**: SQLite 3
- **ORM**: Prisma
- **认证**: JWT
- **API文档**: Swagger

#### 开发工具
- **代码规范**: ESLint + Prettier
- **版本控制**: Git
- **包管理器**: npm

## 项目结构

```
personal-bookkeeping/
├── backend/                 # 后端服务
│   ├── src/
│   │   ├── routes/         # 路由定义
│   │   ├── controllers/    # 控制器
│   │   ├── services/       # 业务逻辑
│   │   ├── models/         # 数据模型
│   │   ├── middleware/     # 中间件
│   │   ├── utils/          # 工具函数
│   │   ├── config/         # 配置文件
│   │   └── types/          # 类型定义
│   ├── prisma/             # 数据库配置
│   │   ├── schema.prisma   # 数据模型定义
│   │   └── seed.ts         # 种子数据
│   └── package.json
├── frontend/               # 前端应用
│   ├── src/
│   │   ├── components/     # React组件
│   │   │   ├── common/     # 通用组件
│   │   │   ├── accounting/ # 记账相关组件
│   │   │   ├── charts/     # 图表组件
│   │   │   └── layout/     # 布局组件
│   │   ├── pages/          # 页面组件
│   │   ├── services/       # API服务
│   │   ├── hooks/          # 自定义Hooks
│   │   ├── store/          # 状态管理
│   │   ├── types/          # TypeScript类型
│   │   ├── utils/          # 工具函数
│   │   ├── contexts/       # React Context
│   │   └── styles/         # 样式文件
│   └── package.json
├── docs/                   # 项目文档
├── MVP设计文档.md
├── 需求文档.md
└── README.md
```

## 快速开始

### 前置要求

- Node.js >= 18.0.0
- npm >= 9.0.0
- Git

### 安装步骤

1. **克隆项目**
```bash
git clone <repository-url>
cd personal-bookkeeping
```

2. **安装后端依赖**
```bash
cd backend
npm install
```

3. **配置后端环境**
```bash
cp .env.example .env
# 编辑 .env 文件，配置必要的环境变量
```

4. **初始化数据库**
```bash
npm run prisma:generate
npm run prisma:push
npm run prisma:seed
```

5. **启动后端服务**
```bash
npm run dev
```
后端服务将运行在 http://localhost:3001

6. **安装前端依赖**
```bash
cd ../frontend
npm install
```

7. **配置前端环境**
```bash
cp .env.example .env
# 编辑 .env 文件，配置API地址
```

8. **启动前端应用**
```bash
npm run dev
```
前端应用将运行在 http://localhost:5173

### 默认账户

系统预置了一个管理员账户：
- 用户名: `admin`
- 邮箱: `admin@example.com`
- 密码: `admin123`

## 开发指南

### 后端开发

```bash
cd backend

# 开发模式（热重载）
npm run dev

# 构建生产版本
npm run build

# 启动生产版本
npm run start

# 数据库操作
npm run prisma:generate  # 生成Prisma客户端
npm run prisma:push      # 同步数据库结构
npm run prisma:seed      # 重置种子数据
```

### 前端开发

```bash
cd frontend

# 开发模式（热重载）
npm run dev

# 构建生产版本
npm run build

# 预览生产版本
npm run preview
```

## API文档

后端API文档将在服务启动后可通过以下地址访问：
- Swagger UI: http://localhost:3001/api-docs
- API基础路径: http://localhost:3001/api

### 主要API端点

- `POST /api/auth/login` - 用户登录
- `POST /api/auth/register` - 用户注册
- `GET /api/accounts` - 获取账户列表
- `POST /api/accounts` - 创建账户
- `GET /api/transactions` - 获取交易列表
- `POST /api/transactions` - 创建交易
- `GET /api/subjects` - 获取会计科目
- `GET /api/reports/balance-sheet` - 资产负债表
- `GET /api/reports/income-statement` - 损益表

## 功能说明

### 复式记账原理

复式记账是现代会计的基础，每笔交易都会影响至少两个账户：

1. **借贷平衡** - 每笔交易的借方金额必须等于贷方金额
2. **账户分类** - 账户分为资产、负债、权益、收入、费用五大类
3. **记账规则** - 不同类型的账户有不同的借贷记账规则

### 账户类型

- **资产类** - 现金、银行存款、应收账款等
- **负债类** - 应付账款、借款、信用卡等
- **权益类** - 实收资本、未分配利润等
- **收入类** - 主营业务收入、其他收入等
- **费用类** - 管理费用、销售费用等

## 数据库设计

系统使用SQLite数据库，主要包含以下数据表：

- `users` - 用户信息
- `accounts` - 账户信息
- `subjects` - 会计科目
- `transactions` - 交易记录
- `transaction_entries` - 交易分录

详细的数据库设计请参考 [MVP设计文档.md](./MVP设计文档.md)

## 浏览器支持

- Chrome >= 90
- Firefox >= 88
- Safari >= 14
- Edge >= 90

## 贡献指南

欢迎提交Issue和Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交Pull Request

## 许可证

本项目采用 MIT 许可证。

## 联系方式

如有问题或建议，请通过以下方式联系：

- 提交 Issue
- 发送邮件至项目维护者

## 更新日志

### v1.0.0 (2024-03-25)
- ✅ 项目初始化
- ✅ 基础架构搭建
- ✅ 数据库设计实现
- ✅ 前后端基础框架
- 🚧 核心功能开发中

## 开发路线图

### Phase 1: MVP版本 (进行中)
- [x] 项目初始化
- [x] 数据库设计
- [x] 基础架构搭建
- [ ] 用户认证系统
- [ ] 账户管理功能
- [ ] 交易记录功能
- [ ] 基础报表功能

### Phase 2: 功能完善
- [ ] 高级报表功能
- [ ] 数据可视化
- [ ] 预算管理
- [ ] 数据导入导出

### Phase 3: 高级功能
- [ ] 云同步功能
- [ ] 移动端适配
- [ ] AI智能建议
- [ ] 多币种支持

---

**注意**: 本项目目前处于开发阶段，功能可能不完整，建议仅用于开发测试环境。# personal-bookkeeping
# personal-bookkeeping
