import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { chat, ChatMessage } from '../ai/agent';

const conversations = new Map<string, { messages: ChatMessage[]; updatedAt: Date }>();

const MAX_HISTORY = 20;
const CONVERSATION_TTL = 30 * 60 * 1000;

function cleanupOldConversations() {
  const now = Date.now();
  for (const [key, val] of conversations) {
    if (now - val.updatedAt.getTime() > CONVERSATION_TTL) {
      conversations.delete(key);
    }
  }
}

setInterval(cleanupOldConversations, 10 * 60 * 1000);

export const aiController = {
  chat: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.userId;
      const { message, conversationId } = req.body;

      if (!userId) {
        res.status(401).json({ success: false, error: { message: '未登录' } });
        return;
      }

      if (!message || typeof message !== 'string') {
        res.status(400).json({ success: false, error: { message: '请提供消息内容' } });
        return;
      }

      const convId = conversationId || userId;
      const conv = conversations.get(convId);
      const history = conv?.messages || [];

      const response = await chat(userId, message, history);

      const updatedMessages: ChatMessage[] = [
        ...history.slice(-(MAX_HISTORY - 2)),
        { role: 'user', content: message, timestamp: new Date() },
        response,
      ];

      conversations.set(convId, { messages: updatedMessages, updatedAt: new Date() });

      res.json({
        success: true,
        data: {
          conversationId: convId,
          message: response.content,
          timestamp: response.timestamp,
        },
      });
    } catch (error: any) {
      console.error('AI chat error:', error);
      if (error.message?.includes('OPENAI_API_KEY')) {
        res.status(503).json({
          success: false,
          error: { message: 'AI服务未配置，请在.env中设置OPENAI_API_KEY', details: error.message },
        });
        return;
      }
      res.status(500).json({
        success: false,
        error: { message: 'AI服务暂时不可用', details: error.message },
      });
    }
  },

  getHistory: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.userId;
      const { conversationId } = req.query;

      if (!userId) {
        res.status(401).json({ success: false, error: { message: '未登录' } });
        return;
      }

      const convId = (conversationId as string) || userId;
      const conv = conversations.get(convId);

      res.json({
        success: true,
        data: {
          conversationId: convId,
          messages: conv?.messages || [],
        },
      });
    } catch (error) {
      console.error('Get history error:', error);
      res.status(500).json({ success: false, error: { message: '获取历史记录失败' } });
    }
  },

  clearHistory: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.userId;
      const { conversationId } = req.body;

      if (!userId) {
        res.status(401).json({ success: false, error: { message: '未登录' } });
        return;
      }

      const convId = conversationId || userId;
      conversations.delete(convId);

      res.json({ success: true, data: { message: '对话历史已清空' } });
    } catch (error) {
      console.error('Clear history error:', error);
      res.status(500).json({ success: false, error: { message: '清空历史失败' } });
    }
  },
};
