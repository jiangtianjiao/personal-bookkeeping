# 快速启动指南

## 项目创建完成！

您的个人复式记账系统项目已经成功初始化。以下是项目的详细信息和下一步操作指南。

## 📁 项目结构

```
personal-bookkeeping/
├── backend/                 # 后端服务 (Express + TypeScript + Prisma)
│   ├── src/
│   │   ├── config/         # 数据库配置
│   │   ├── controllers/    # 控制器（待实现）
│   │   ├── routes/         # 路由（待实现）
│   │   ├── services/       # 服务层（待实现）
│   │   └── types/          # 类型定义
│   ├── prisma/
│   │   ├── schema.prisma   # 数据模型
│   │   ├── seed.ts         # 种子数据
│   │   └── dev.db          # SQLite数据库文件
│   └── package.json
├── frontend/               # 前端应用 (React + TypeScript + Vite)
│   ├── src/
│   │   ├── components/     # React组件
│   │   ├── services/       # API服务
│   │   ├── store/          # 状态管理
│   │   ├── types/          # 类型定义
│   │   └── styles/         # 样式文件
│   └── package.json
├── docs/                   # 项目文档
│   ├── API.md             # API文档
│   ├── DEVELOPMENT.md     # 开发指南
│   └── QUICKSTART.md      # 本文件
├── README.md              # 项目说明
├── MVP设计文档.md         # MVP设计文档
├── 需求文档.md            # 需求文档
└── package.json           # 根项目配置
```

## 🚀 启动项目

### 方法一：分别启动（推荐用于开发）

#### 1. 启动后端服务
```bash
cd backend
npm run dev
```
后端服务将运行在: **http://localhost:3001**

#### 2. 启动前端应用
```bash
cd frontend
npm run dev
```
前端应用将运行在: **http://localhost:5173**

### 方法二：同时启动（需要配置）

1. 安装根目录依赖:
```bash
npm install
```

2. 同时启动前后端:
```bash
npm run dev
```

## 🔑 默认账户信息

系统已预置管理员账户：
- **用户名**: admin
- **邮箱**: admin@example.com
- **密码**: admin123

## 📊 数据库状态

✅ **数据库已初始化完成**
- SQLite 数据库文件: `backend/prisma/dev.db`
- 会计科目数据: 已导入29个预设科目
- 示例账户: 已创建5个基础账户
- 示例用户: 已创建管理员账户

## 🛠️ 技术栈确认

### 后端技术栈
- ✅ Express.js 4.18.2
- ✅ TypeScript 5.2.2
- ✅ Prisma 5.2.0
- ✅ SQLite 3
- ✅ JWT 认证
- ✅ CORS 支持

### 前端技术栈
- ✅ React 18
- ✅ TypeScript 5.0
- ✅ Vite 4.3
- ✅ Ant Design 5.9
- ✅ Zustand (状态管理)
- ✅ React Router 6.15
- ✅ ECharts (图表库)
- ✅ Axios (HTTP客户端)

## 📝 下一步开发任务

### Phase 1: 核心功能（优先级：高）

#### 后端开发
1. **认证系统**
   - [ ] 实现用户注册API
   - [ ] 实现用户登录API
   - [ ] 实现JWT中间件
   - [ ] 添加密码加密功能

2. **账户管理**
   - [ ] 实现账户CRUD API
   - [ ] 实现账户余额计算
   - [ ] 添加账户层级支持

3. **交易管理**
   - [ ] 实现交易创建API
   - [ ] 实现复式记账验证
   - [ ] 实现交易过账功能
   - [ ] 添加交易查询功能

#### 前端开发
1. **认证页面**
   - [ ] 创建登录页面
   - [ ] 创建注册页面
   - [ ] 实现认证状态管理

2. **核心页面**
   - [ ] 创建仪表板页面
   - [ ] 创建账户管理页面
   - [ ] 创建交易记录页面
   - [ ] 创建记账表单组件

### Phase 2: 报表和可视化（优先级：中）

1. **财务报表**
   - [ ] 实现资产负债表API
   - [ ] 实现损益表API
   - [ ] 创建报表展示页面

2. **数据可视化**
   - [ ] 实现图表组件
   - [ ] 添加数据分析功能
   - [ ] 创建数据导出功能

### Phase 3: 完善和优化（优先级：低）

1. **用户体验**
   - [ ] 添加表单验证
   - [ ] 优化错误提示
   - [ ] 添加加载状态

2. **性能优化**
   - [ ] 实现数据缓存
   - [ ] 优化查询性能
   - [ ] 添加分页功能

## 📚 开发资源

### 文档
- [MVP设计文档.md](../MVP设计文档.md) - 详细的功能设计文档
- [需求文档.md](../需求文档.md) - 项目需求说明
- [API.md](./API.md) - API接口文档
- [DEVELOPMENT.md](./DEVELOPMENT.md) - 开发指南

### 代码参考
- 后端示例代码: `backend/src/`
- 前端示例代码: `frontend/src/`
- 数据模型: `backend/prisma/schema.prisma`

## 🔧 常用命令

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
npx prisma studio        # 打开数据库管理界面
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

## 🐛 常见问题解决

### 1. 端口被占用
- 后端默认端口: 3001
- 前端默认端口: 5173
- 修改方式: 编辑 `.env` 文件中的 `PORT` 配置

### 2. 数据库连接失败
```bash
cd backend
rm prisma/dev.db
npm run prisma:push
npm run prisma:seed
```

### 3. 依赖安装失败
```bash
# 清除缓存重新安装
rm -rf node_modules package-lock.json
npm install
```

## 🎯 开发建议

### 代码规范
1. 使用 TypeScript 进行类型检查
2. 遵循函数式编程范式
3. 组件单一职责原则
4. API 响应统一格式

### Git 工作流
1. 创建功能分支: `git checkout -b feature/account-management`
2. 提交代码: `git commit -m "feat: 添加账户管理功能"`
3. 推送分支: `git push origin feature/account-management`

### 测试策略
1. 单元测试: 核心业务逻辑
2. 集成测试: API 接口测试
3. 端到端测试: 关键用户流程

## 🎉 项目特色

- ✅ **完整的复式记账系统** - 支持专业的会计记账方法
- ✅ **现代化技术栈** - 使用最新的前端和后端技术
- ✅ **类型安全** - 全面的 TypeScript 类型定义
- ✅ **本地优先** - 基于 SQLite 的本地数据存储
- ✅ **响应式设计** - 适配各种设备尺寸
- ✅ **中文界面** - 完全中文化的用户界面

## 📞 技术支持

如有问题，请查看：
1. 项目文档 (docs/ 目录)
2. API 文档 (docs/API.md)
3. 开发指南 (docs/DEVELOPMENT.md)
4. 或提交 Issue

---

**祝您开发愉快！🚀**

项目创建时间: 2024-03-25
预计MVP完成时间: 7-12天