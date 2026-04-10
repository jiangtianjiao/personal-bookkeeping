import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { connectDatabase, disconnectDatabase } from './config/database';
import authRoutes from './routes/auth';
import accountRoutes from './routes/accounts';
import transactionRoutes from './routes/transactions';
import reportRoutes from './routes/reports';
import categoryRoutes from './routes/categories';
import tagRoutes from './routes/tags';
import ruleRoutes from './routes/rules';
import recurringRoutes from './routes/recurring';
import budgetRoutes from './routes/budgets';
import piggyBankRoutes from './routes/piggyBanks';
import importRoutes from './routes/import';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { setupApiDocs } from './config/apiDocs';

dotenv.config();

// JWT_SECRET startup validation
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 32 || /dev-|change-|test|example|default/i.test(jwtSecret)) {
  console.error('FATAL: JWT_SECRET is not set, too short (min 32 chars), or appears to be a weak/default value.');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3001;

// Rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // max 20 attempts per window
  message: { success: false, error: { message: 'Too many attempts, please try again later.' } },
  standardHeaders: true,
  legacyHeaders: false,
});

const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: { success: false, error: { message: 'Too many requests, please slow down.' } },
  standardHeaders: true,
  legacyHeaders: false,
});

const importLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { success: false, error: { message: 'Import rate limit exceeded.' } },
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(requestLogger);

// Health check route
const serverStartTime = Date.now();
app.get('/health', async (_req, res) => {
  let dbStatus = 'disconnected';
  try {
    const { default: prisma } = await import('./config/database');
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'connected';
  } catch {
    dbStatus = 'disconnected';
  }
  res.json({
    status: 'OK',
    uptime: Math.floor((Date.now() - serverStartTime) / 1000),
    version: '1.0.0',
    database: dbStatus,
  });
});

// API docs
setupApiDocs(app);

// Apply rate limiting
app.use('/api', globalLimiter);
app.use('/api/import', importLimiter);
app.use('/api/email-import', importLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/rules', ruleRoutes);
app.use('/api/recurring', recurringRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/piggy-banks', piggyBankRoutes);
app.use('/api', importRoutes);

// API info route
app.get('/api', (req, res) => {
  res.json({
    message: 'Personal Bookkeeping API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      accounts: '/api/accounts',
      transactions: '/api/transactions',
      categories: '/api/categories',
      reports: '/api/reports',
      tags: '/api/tags',
      rules: '/api/rules',
      recurring: '/api/recurring',
      budgets: '/api/budgets',
      piggyBanks: '/api/piggy-banks',
      import: '/api/import/upload',
      export: '/api/export',
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: { message: 'Route not found.' } });
});

// Global error handler (must be after all routes)
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    await connectDatabase();
    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
      console.log(`API Documentation: http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  await disconnectDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await disconnectDatabase();
  process.exit(0);
});

startServer();

export default app;
