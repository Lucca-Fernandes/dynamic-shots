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
