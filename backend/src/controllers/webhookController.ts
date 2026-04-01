import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export const handleEvolutionWebhook = async (req: Request, res: Response) => {
  const { event, instance: instanceName, data } = req.body;

  res.status(200).json({ ok: true });

  setImmediate(async () => {
    try {
      // v1.6.x: CONNECTION_UPDATE | v2.x: connection.update
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

        console.log(`Webhook: ${instanceName} -> ${newStatus}`);
      }
    } catch (err) {
      console.error('Erro processando webhook:', err);
    }
  });
};
