import { Router } from 'express';
import { createInstance, deleteInstance, getMyInstances, getQRCode, syncInstanceStatus } from '../controllers/instanceController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

router.use(authMiddleware);

router.get('/', getMyInstances);
router.post('/', createInstance);
router.get('/:id/connect', getQRCode);
router.get('/:id/sync', syncInstanceStatus); 
router.delete('/:id', deleteInstance);

export default router;