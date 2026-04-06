import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export const handleEvolutionWebhook = async (req: Request, res: Response) => {
  const { event, instance: instanceName, data } = req.body;

  if (!instanceName || typeof instanceName !== 'string' || !/^[\w-]+$/.test(instanceName)) {
    return res.status(400).json({ error: 'Invalid instance' });
  }

  res.status(200).json({ ok: true });

  setImmediate(async () => {
    try {
      const normalizedEvent = event?.toLowerCase?.().replace(/_/g, '.');

      if (normalizedEvent === 'connection.update') {
        const stateMap: Record<string, string> = {
          open: 'CONNECTED',
          close: 'DISCONNECTED',
          connecting: 'CONNECTING',
        };
        const newStatus = stateMap[data?.state] || 'DISCONNECTED';

        await prisma.instance.updateMany({
          where: { name: instanceName },
          data: { status: newStatus }
        });
      }
    } catch (err) {
      console.error('Webhook processing error:', err);
    }
  });
};
