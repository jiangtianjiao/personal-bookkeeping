import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/database';
import { JWT_SECRET } from '../middleware/auth';
import { DEFAULT_ACCOUNTS, DEFAULT_CATEGORIES } from '../data/defaults';
import { AppError, NotFoundError, ConflictError } from '../errors/AppError';

export interface RegisterData {
  username: string;
  email: string;
  password: string;
}

export interface UpdateProfileData {
  username?: string;
  email?: string;
}

async function initializeUserData(tx: any, userId: string) {
  for (const acc of DEFAULT_ACCOUNTS) {
    await tx.account.create({
      data: {
        userId,
        name: acc.name,
        accountType: acc.accountType,
        icon: acc.icon,
        isActive: true,
      },
    });
  }

  for (const cat of DEFAULT_CATEGORIES) {
    await tx.category.create({
      data: {
        userId,
        name: cat.name,
        type: cat.type,
        icon: cat.icon,
        isSystem: true,
        sortOrder: cat.sortOrder,
      },
    });
  }
}

export const userService = {
  register: async (email: string, username: string, password: string) => {
    if (!username || !email || !password) {
      throw new AppError(400, 'Username, email, and password are required.');
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existingUser) {
      throw new ConflictError('User with this email or username already exists.');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await prisma.$transaction(async (tx: any) => {
      const newUser = await tx.user.create({
        data: {
          username,
          email,
          passwordHash,
        },
        select: {
          id: true,
          username: true,
          email: true,
          createdAt: true,
        },
      });

      await initializeUserData(tx, newUser.id);

      return newUser;
    });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    return { user, token };
  },

  login: async (email: string, password: string) => {
    if (!email || !password) {
      throw new AppError(400, 'Email and password are required.');
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new AppError(401, 'Invalid email or password.');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new AppError(401, 'Invalid email or password.');
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        createdAt: user.createdAt,
      },
      token,
    };
  },

  getProfile: async (userId: string) => {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundError('User');
    }

    return user;
  },

  updateProfile: async (userId: string, data: UpdateProfileData) => {
    const { username, email } = data;

    if (!username && !email) {
      throw new AppError(400, 'At least one field (username or email) is required.');
    }

    if (email || username) {
      const existing = await prisma.user.findFirst({
        where: {
          OR: [
            ...(email ? [{ email }] : []),
            ...(username ? [{ username }] : []),
          ],
          id: { not: userId },
        },
      });
      if (existing) {
        throw new ConflictError('Username or email already taken.');
      }
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(username && { username }),
        ...(email && { email }),
      },
      select: {
        id: true,
        username: true,
        email: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return user;
  },

  changePassword: async (userId: string, currentPassword: string, newPassword: string) => {
    if (!currentPassword || !newPassword) {
      throw new AppError(400, 'Current password and new password are required.');
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundError('User');
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isPasswordValid) {
      throw new AppError(401, 'Current password is incorrect.');
    }

    if (!newPassword || newPassword.length < 8) {
      throw new AppError(400, 'New password must be at least 8 characters.');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return { message: 'Password changed successfully.' };
  },
};
