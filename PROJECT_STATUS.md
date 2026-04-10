# 个人复式记账系统 - 项目状态

## 当前状态：Phase 1 MVP 开发中

### 已完成

#### 后端
- [x] 项目初始化 (Express + TypeScript + Prisma + SQLite)
- [x] 数据模型设计 (User, Account, Category, Transaction, TransactionEntry)
- [x] 金额字段使用 Decimal 类型
- [x] 用户认证 API (注册/登录/JWT)
- [x] 账户管理 API (CRUD + 余额计算)
- [x] 分类管理 API (CRUD + 系统预设)
- [x] 交易管理 API (快捷记账 + 手动分录 + 借贷平衡校验)
- [x] 报表 API (资产负债表/收支报表/试算平衡/仪表板)
- [x] 种子数据 (默认用户 + 生活化分类 + 默认账户)

#### 前端
- [x] 项目初始化 (React 18 + TypeScript + Vite + Ant Design)
- [x] 路由配置 (React Router 6 + 登录/注册/主布局)
- [x] 认证系统 (登录/注册页面 + JWT Token 管理)
- [x] 仪表板页面 (收支概览 + 近期交易)
- [x] 记账页面 (快捷记账表单 + 交易列表)
- [x] 账户管理页面 (账户列表 + 新建/编辑)
- [x] 报表页面 (资产负债表 + 收支报表 + 图表)
- [x] 设置页面

#### 文档
- [x] 需求文档 v2.0 (明确个人记账定位)
- [x] MVP设计文档

### 待完成 (Phase 2)
- [ ] 交易模板和周期性交易
- [ ] 高级分录编辑器
- [ ] 会计期间管理 (结账/反结账)
- [ ] 预算管理
- [ ] 数据导入导出 (CSV)
- [ ] 暗/亮主题切换
- [ ] ECharts 图表集成完善

## 启动项目

### 后端
```bash
cd backend
npm install
npm run setup    # 安装依赖 + 生成Prisma客户端 + 初始化数据库
npm run dev      # 启动开发服务器 http://localhost:3001
```

### 前端
```bash
cd frontend
npm install
npm run dev      # 启动开发服务器 http://localhost:5173
```

### 默认账户
- 邮箱: admin@example.com
- 密码: admin123
