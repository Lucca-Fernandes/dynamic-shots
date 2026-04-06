import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';

export const campaignProgress = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const token = req.query.token as string;

  if (!token) {
    return res.status(401).json({ error: 'Token necessario' });
  }

  let userId: string;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    userId = decoded.userId;
  } catch {
    return res.status(401).json({ error: 'Token invalido' });
  }

  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign || campaign.ownerId !== userId) {
    return res.status(404).json({ error: 'Campanha nao encontrada' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  const sendUpdate = async () => {
    try {
      const fresh = await prisma.campaign.findUnique({
        where: { id },
        select: { status: true, sentCount: true, errorCount: true, totalLeads: true, startedAt: true, completedAt: true }
      });

      if (!fresh) {
        res.write(`data: ${JSON.stringify({ error: 'Campanha removida' })}\n\n`);
        clearInterval(interval);
        res.end();
        return;
      }

      res.write(`data: ${JSON.stringify(fresh)}\n\n`);

      if (['COMPLETED', 'CANCELLED'].includes(fresh.status)) {
        clearInterval(interval);
        res.end();
      }
    } catch {
      // silent
    }
  };

  await sendUpdate();
  const interval = setInterval(sendUpdate, 2000);

  req.on('close', () => { clearInterval(interval); });
};
