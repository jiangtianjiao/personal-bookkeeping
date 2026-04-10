import prisma from '../config/database';
import { AppError, NotFoundError, ConflictError } from '../errors/AppError';

export const tagService = {
  async list(userId: string) {
    return prisma.tag.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
    });
  },

  async create(userId: string, data: { name: string; color?: string }) {
    if (!data.name) {
      throw new AppError(400, 'Tag name is required.');
    }

    const existing = await prisma.tag.findFirst({
      where: { userId, name: data.name },
    });
    if (existing) {
      throw new ConflictError('A tag with this name already exists.');
    }

    return prisma.tag.create({
      data: {
        userId,
        name: data.name,
        color: data.color || null,
      },
    });
  },

  async update(userId: string, tagId: string, data: { name?: string; color?: string }) {
    const existing = await prisma.tag.findFirst({
      where: { id: tagId, userId },
    });
    if (!existing) {
      throw new NotFoundError('Tag');
    }

    if (data.name && data.name !== existing.name) {
      const duplicate = await prisma.tag.findFirst({
        where: { userId, name: data.name, id: { not: tagId } },
      });
      if (duplicate) {
        throw new ConflictError('A tag with this name already exists.');
      }
    }

    return prisma.tag.update({
      where: { id: tagId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.color !== undefined && { color: data.color }),
      },
    });
  },

  async delete(userId: string, tagId: string) {
    const existing = await prisma.tag.findFirst({
      where: { id: tagId, userId },
    });
    if (!existing) {
      throw new NotFoundError('Tag');
    }

    await prisma.$transaction([
      prisma.transactionTag.deleteMany({ where: { tagId } }),
      prisma.tag.delete({ where: { id: tagId } }),
    ]);

    return { message: 'Tag deleted successfully.' };
  },

  async addToTransaction(userId: string, transactionId: string, tagIds: string[]) {
    if (!tagIds || tagIds.length === 0) {
      throw new AppError(400, 'At least one tagId is required.');
    }

    const transaction = await prisma.transaction.findFirst({
      where: { id: transactionId, userId },
    });
    if (!transaction) {
      throw new NotFoundError('Transaction');
    }

    const tags = await prisma.tag.findMany({
      where: { id: { in: tagIds }, userId },
    });
    if (tags.length !== tagIds.length) {
      throw new AppError(400, 'One or more tags not found.');
    }

    const existingLinks = await prisma.transactionTag.findMany({
      where: { transactionId, tagId: { in: tagIds } },
    });
    const existingTagIds = new Set(existingLinks.map((l: { tagId: string }) => l.tagId));
    const newTagIds = tagIds.filter((id) => !existingTagIds.has(id));

    if (newTagIds.length > 0) {
      await prisma.transactionTag.createMany({
        data: newTagIds.map((tagId) => ({ transactionId, tagId })),
      });
    }

    return prisma.transactionTag.findMany({
      where: { transactionId },
      include: { tag: true },
    });
  },

  async removeFromTransaction(userId: string, transactionId: string, tagId: string) {
    const transaction = await prisma.transaction.findFirst({
      where: { id: transactionId, userId },
    });
    if (!transaction) {
      throw new NotFoundError('Transaction');
    }

    const link = await prisma.transactionTag.findUnique({
      where: { transactionId_tagId: { transactionId, tagId } },
    });
    if (!link) {
      throw new NotFoundError('TransactionTag');
    }

    await prisma.transactionTag.delete({
      where: { transactionId_tagId: { transactionId, tagId } },
    });

    return { message: 'Tag removed from transaction.' };
  },
};
