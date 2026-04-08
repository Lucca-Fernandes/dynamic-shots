import { Router } from 'express';
import { bulkSend } from '../controllers/sendController';
import { authMiddleware, permissionMiddleware, dailyLimitMiddleware, mediaPermissionMiddleware } from '../middlewares/authMiddleware';
import multer from 'multer';

const messageRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

messageRouter.post('/bulk', authMiddleware, permissionMiddleware('quickSend'), upload.fields([{ name: 'media', maxCount: 1 }]), mediaPermissionMiddleware, dailyLimitMiddleware, bulkSend);

export default messageRouter;