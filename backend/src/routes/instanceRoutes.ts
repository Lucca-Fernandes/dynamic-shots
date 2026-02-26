import { Router } from 'express';
import { createInstance, getMyInstances } from '../controllers/instanceController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { getQRCode } from '../controllers/instanceController';

const router = Router();
const instanceRouter = Router();
instanceRouter.get('/:id/connect', getQRCode);
router.use(authMiddleware);

router.post('/', createInstance);
router.get('/', getMyInstances);

export default router;