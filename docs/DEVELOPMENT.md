# 开发指南

## 项目设置

### 环境要求
- Node.js >= 18.0.0
- npm >= 9.0.0
- Git

### 开发工具推荐
- VS Code / WebStorm
- Postman (API测试)
- DB Browser for SQLite (数据库查看)

## 开发流程

### 1. 项目初始化

```bash
# 克隆项目
git clone <repository-url>
cd personal-bookkeeping

# 安装所有依赖
npm run install:all

# 设置数据库
npm run db:setup

# 启动开发环境
npm run dev
```

### 2. 后端开发

后端服务位于 `backend/` 目录，使用 Express.js + TypeScript + Prisma。

#### 目录结构
```
backend/
├── src/
│   ├── routes/          # API路由
│   ├── controllers/     # 控制器（业务逻辑）
│   ├── services/        # 服务层（复用逻辑）
│   ├── middleware/      # 中间件
│   ├── utils/           # 工具函数
│   ├── config/          # 配置文件
│   ├── types/           # TypeScript类型
│   └── index.ts         # 入口文件
├── prisma/
│   ├── schema.prisma    # 数据模型
│   └── seed.ts          # 种子数据
└── package.json
```

#### 开发命令
```bash
cd backend

# 开发模式（热重载）
npm run dev

# 构建生产版本
npm run build

# 启动生产版本
npm run start

# 数据库操作
npm run prisma:generate
npm run prisma:push
npm run prisma:seed
```

#### API开发规范

1. **路由定义** (`src/routes/`)
```typescript
import express from 'express';
import { accountController } from '../controllers/account.controller';

const router = express.Router();

router.get('/', accountController.getAccounts);
router.post('/', accountController.createAccount);
// ...

export default router;
```

2. **控制器实现** (`src/controllers/`)
```typescript
import { Request, Response } from 'express';
import { accountService } from '../services/account.service';

export const accountController = {
  getAccounts: async (req: Request, res: Response) => {
    try {
      const accounts = await accountService.getAllAccounts();
      res.json({ success: true, data: accounts });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
  // ...
};
```

3. **服务层** (`src/services/`)
```typescript
import prisma from '../config/database';

export const accountService = {
  getAllAccounts: async () => {
    return await prisma.account.findMany();
  },
  // ...
};
```

### 3. 前端开发

前端应用位于 `frontend/` 目录，使用 React 18 + TypeScript + Vite。

#### 目录结构
```
frontend/
├── src/
│   ├── components/      # React组件
│   │   ├── common/      # 通用组件
│   │   ├── accounting/  # 记账相关组件
│   │   ├── charts/      # 图表组件
│   │   └── layout/      # 布局组件
│   ├── pages/           # 页面组件
│   ├── services/        # API服务
│   ├── hooks/           # 自定义Hooks
│   ├── store/           # 状态管理
│   ├── types/           # TypeScript类型
│   ├── utils/           # 工具函数
│   ├── contexts/        # React Context
│   └── styles/          # 样式文件
├── public/              # 静态资源
└── package.json
```

#### 开发命令
```bash
cd frontend

# 开发模式（热重载）
npm run dev

# 构建生产版本
npm run build

# 预览生产版本
npm run preview
```

#### 组件开发规范

1. **函数式组件** + Hooks
```typescript
import React from 'react';
import { Button } from 'antd';

interface Props {
  title: string;
  onClick: () => void;
}

const MyComponent: React.FC<Props> = ({ title, onClick }) => {
  return (
    <Button type="primary" onClick={onClick}>
      {title}
    </Button>
  );
};

export default MyComponent;
```

2. **状态管理** (Zustand)
```typescript
import { create } from 'zustand';

interface MyStore {
  data: any[];
  setData: (data: any[]) => void;
}

export const useMyStore = create<MyStore>((set) => ({
  data: [],
  setData: (data) => set({ data }),
}));
```

3. **API调用**
```typescript
import { apiService } from '../services/api';

export const getAccounts = async () => {
  return await apiService.get<Account[]>('/accounts');
};
```

## 数据库管理

### Prisma 使用

```bash
# 修改 schema.prisma 后执行
npx prisma generate

# 同步数据库结构
npx prisma db push

# 创建迁移（生产环境）
npx prisma migrate dev

# 重置数据库
npx prisma migrate reset

# 查看数据库
npx prisma studio
```

### 数据模型设计

数据模型定义在 `backend/prisma/schema.prisma`：

```prisma
model Account {
  id          String   @id @default(uuid())
  name        String
  accountType String
  balance     Float    @default(0)
  // ...
}
```

## 测试

### 后端测试
```bash
cd backend
npm test
```

### 前端测试
```bash
cd frontend
npm test
```

## 代码规范

### TypeScript 规范
- 使用严格模式
- 明确类型注解
- 避免使用 `any`

### React 规范
- 使用函数式组件
- Hooks 遵循规则
- 组件单一职责

### 命名规范
- 文件名: kebab-case (`my-component.tsx`)
- 组件名: PascalCase (`MyComponent`)
- 函数/变量: camelCase (`myFunction`)
- 常量: UPPER_SNAKE_CASE (`API_BASE_URL`)

## 调试技巧

### 后端调试
1. 使用 VS Code 调试器
2. 在 `src/index.ts` 设置断点
3. 启动调试配置

### 前端调试
1. 使用浏览器开发工具
2. React DevTools
3. Redux DevTools (Zustand)

### 数据库调试
```bash
# 启动 Prisma Studio
npx prisma studio
# 访问 http://localhost:5555
```

## 部署

### 后端部署
```bash
cd backend
npm run build
npm run start
```

### 前端部署
```bash
cd frontend
npm run build
# 将 dist/ 目录部署到静态服务器
```

## 常见问题

### 1. 端口冲突
修改 `.env` 文件中的端口配置

### 2. 数据库连接失败
检查 SQLite 文件权限和路径

### 3. CORS 错误
确保后端 CORS 配置正确

## 性能优化

### 后端优化
- 数据库查询优化
- API 响应缓存
- 分页查询

### 前端优化
- 代码分割
- 懒加载
- 图片优化

## 安全考虑

1. 输入验证
2. SQL 注入防护
3. XSS 防护
4. CSRF 防护
5. 密码加密

## 下一步开发

参考 [MVP设计文档.md](../MVP设计文档.md) 和 [需求文档.md](../需求文档.md) 进行功能开发。