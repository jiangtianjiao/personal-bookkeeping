import prisma from '../config/database';
import { AppError, NotFoundError, ConflictError } from '../errors/AppError';

const VALID_CATEGORY_TYPES = ['income', 'expense', 'transfer'];

export interface CreateCategoryData {
  name: string;
  type: string;
  icon?: string;
  sortOrder?: number;
}

export interface UpdateCategoryData {
  name?: string;
  type?: string;
  icon?: string;
  sortOrder?: number;
}

export const categoryService = {
  list: async (userId: string, type?: string) => {
    const where: any = { userId };
    if (type) where.type = type;

    const categories = await prisma.category.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    return categories;
  },

  getById: async (userId: string, categoryId: string) => {
    const category = await prisma.category.findFirst({
      where: { id: categoryId, userId },
    });

    if (!category) {
      throw new NotFoundError('Category');
    }

    return category;
  },

  create: async (userId: string, data: CreateCategoryData) => {
    const { name, type, icon, sortOrder } = data;

    if (!name || !type) {
      throw new AppError(400, 'Category name and type are required.');
    }

    if (!VALID_CATEGORY_TYPES.includes(type)) {
      throw new AppError(400, `Invalid category type. Must be one of: ${VALID_CATEGORY_TYPES.join(', ')}`);
    }

    const existing = await prisma.category.findFirst({
      where: { userId, name, type },
    });
    if (existing) {
      throw new ConflictError('A category with this name and type already exists.');
    }

    const category = await prisma.category.create({
      data: {
        userId,
        name,
        type,
        icon: icon || null,
        isSystem: false,
        sortOrder: sortOrder || 0,
      },
    });

    return category;
  },

  update: async (userId: string, categoryId: string, data: UpdateCategoryData) => {
    const { name, type, icon, sortOrder } = data;

    const existing = await prisma.category.findFirst({
      where: { id: categoryId, userId },
    });

    if (!existing) {
      throw new NotFoundError('Category');
    }

    if (existing.isSystem) {
      throw new AppError(400, 'Cannot modify system categories.');
    }

    if (type && !VALID_CATEGORY_TYPES.includes(type)) {
      throw new AppError(400, `Invalid category type. Must be one of: ${VALID_CATEGORY_TYPES.join(', ')}`);
    }

    const newName = name || existing.name;
    const newType = type || existing.type;
    if (newName !== existing.name || newType !== existing.type) {
      const duplicate = await prisma.category.findFirst({
        where: { userId, name: newName, type: newType, id: { not: categoryId } },
      });
      if (duplicate) {
        throw new ConflictError('A category with this name and type already exists.');
      }
    }

    const category = await prisma.category.update({
      where: { id: categoryId },
      data: {
        ...(name !== undefined && { name }),
        ...(type !== undefined && { type }),
        ...(icon !== undefined && { icon }),
        ...(sortOrder !== undefined && { sortOrder }),
      },
    });

    return category;
  },

  delete: async (userId: string, categoryId: string) => {
    const existing = await prisma.category.findFirst({
      where: { id: categoryId, userId },
    });

    if (!existing) {
      throw new NotFoundError('Category');
    }

    if (existing.isSystem) {
      throw new AppError(400, 'Cannot delete system categories.');
    }

    await prisma.category.delete({ where: { id: categoryId } });

    return { message: 'Category deleted successfully.' };
  },
};
