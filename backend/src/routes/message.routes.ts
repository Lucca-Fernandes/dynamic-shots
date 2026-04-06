import { Router } from 'express';
import { bulkSend } from '../controllers/sendController';
import { authMiddleware, permissionMiddleware, dailyLimitMiddleware } from '../middlewares/authMiddleware';

const messageRouter = Router();

messageRouter.post('/bulk', authMiddleware, permissionMiddleware('quickSend'), dailyLimitMiddleware, bulkSend);

export default messageRouter;