import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';

export const authMiddleware = (req: any, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  const [, token] = authHeader.split(' ');

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };

    req.userId = decoded.userId;

    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
};

export const roleMiddleware = (role: string) => {
  return async (req: any, res: Response, next: NextFunction) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { role: true }
      });

      if (!user || user.role !== role) {
        return res.status(403).json({ error: 'Acesso negado' });
      }

      return next();
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao verificar permissões' });
    }
  };
};

export const permissionMiddleware = (permission: string) => {
  return async (req: any, res: Response, next: NextFunction) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { permissions: true, role: true, isSuspended: true }
      });

      if (!user) return res.status(401).json({ error: 'Usuario nao encontrado' });

      if (user.isSuspended) {
        return res.status(403).json({ error: 'Sua conta esta suspensa. Entre em contato com o administrador.' });
      }

      // Admins bypass permission checks
      if (user.role === 'ADMIN') return next();

      const perms = (user.permissions as Record<string, boolean>) || {};
      if (!perms[permission]) {
        return res.status(403).json({ error: 'Voce nao tem permissao para esta funcionalidade.' });
      }

      return next();
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao verificar permissoes' });
    }
  };
};

export const dailyLimitMiddleware = async (req: any, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { maxDailyShots: true, dailyShotsSent: true, dailyShotsDate: true, role: true }
    });

    if (!user) return res.status(401).json({ error: 'Usuario nao encontrado' });
    if (user.role === 'ADMIN') return next();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const userDate = user.dailyShotsDate ? new Date(user.dailyShotsDate) : null;
    const isToday = userDate && new Date(userDate).setHours(0, 0, 0, 0) === today.getTime();
    const currentDaily = isToday ? user.dailyShotsSent : 0;

    if (currentDaily >= user.maxDailyShots) {
      return res.status(429).json({
        error: `Limite diario de ${user.maxDailyShots} disparos atingido. Aguarde ate amanha ou contate o administrador.`,
        dailyLimit: user.maxDailyShots,
        dailySent: currentDaily
      });
    }

    return next();
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao verificar limite' });
  }
};
