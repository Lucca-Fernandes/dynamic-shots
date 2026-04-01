import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../middlewares/authMiddleware';
import { uploadMedia } from '../controllers/uploadController';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit for videos
});

router.post('/media', authMiddleware, upload.single('file'), uploadMedia);

export default router;
