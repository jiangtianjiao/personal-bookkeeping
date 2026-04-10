import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { userService } from '../services/userService';

export const authController = {
  register: async (req: AuthRequest, res: Response): Promise<void> => {
    const { username, email, password } = req.body;
    const result = await userService.register(email, username, password);
    res.status(201).json({ success: true, data: result });
  },

  login: async (req: AuthRequest, res: Response): Promise<void> => {
    const { email, password } = req.body;
    const result = await userService.login(email, password);
    res.json({ success: true, data: result });
  },

  getProfile: async (req: AuthRequest, res: Response): Promise<void> => {
    const user = await userService.getProfile(req.userId);
    res.json({ success: true, data: user });
  },

  updateProfile: async (req: AuthRequest, res: Response): Promise<void> => {
    const { username, email } = req.body;
    const user = await userService.updateProfile(req.userId, { username, email });
    res.json({ success: true, data: user });
  },

  changePassword: async (req: AuthRequest, res: Response): Promise<void> => {
    const { currentPassword, newPassword } = req.body;
    const result = await userService.changePassword(req.userId, currentPassword, newPassword);
    res.json({ success: true, data: result });
  },
};
