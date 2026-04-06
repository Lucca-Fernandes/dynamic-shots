import { Router } from 'express';
import { register, login, approveUser, getUsers, updateUser, getUserStats, resetDailyShots, getMyLimits } from '../controllers/authController';
import { authMiddleware, roleMiddleware } from '../middlewares/authMiddleware';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me/limits', authMiddleware, getMyLimits);
router.get('/users', authMiddleware, roleMiddleware('ADMIN'), getUsers);
router.get('/users/stats', authMiddleware, roleMiddleware('ADMIN'), getUserStats);
router.patch('/users/:id/approve', authMiddleware, roleMiddleware('ADMIN'), approveUser);
router.put('/users/:id', authMiddleware, roleMiddleware('ADMIN'), updateUser);
router.post('/users/:id/reset-daily', authMiddleware, roleMiddleware('ADMIN'), resetDailyShots);

export default router;
