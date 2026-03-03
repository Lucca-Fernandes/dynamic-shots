import { Request, Response } from 'express';
import axios from 'axios';
import { prisma } from '../lib/prisma'; 

export async function bulkSend(req: Request, res: Response) {
  const { instanceId, message, numbers } = req.body;

  try {
    const instance = await prisma.instance.findUnique({
      where: { id: instanceId }
    });

    if (!instance) return res.status(404).json({ error: "Instância não encontrada" });
    // verify ownership (assuming req.userId is populated by middleware)
    if ((req as any).userId !== instance.ownerId) {
      return res.status(403).json({ error: 'Não autorizado' });
    }

    if (instance.busy) {
      return res.status(409).json({ error: 'Outro disparo já está em andamento para esta instância' });
    }

    // mark as busy before starting
    await prisma.instance.update({ where: { id: instanceId }, data: { busy: true } });

    res.status(202).json({ message: "Disparo iniciado com sucesso" });

    // execute sending asynchronously
    (async () => {
      try {
        for (const number of numbers) {
          try {
            const cleanNumber = number.replace(/\D/g, '');
            
            await axios.post(
              `${process.env.EVOLUTION_API_URL}/message/sendText/${instance.name}`,
              {
                number: `${cleanNumber}@s.whatsapp.net`,
                textMessage: { text: message }
              },
              { headers: { 'apikey': process.env.EVOLUTION_API_KEY } }
            );

            console.log(`Mensagem enviada para: ${cleanNumber}`);
          } catch (err) {
            console.error(`Erro ao enviar para ${number}`);
          }

          await new Promise(resolve => setTimeout(resolve, 30000));
        }
      } finally {
        // always clear busy flag
        await prisma.instance.update({ where: { id: instanceId }, data: { busy: false } });
      }
    })();
  } catch (error) {
    console.error("Erro no controlador de disparo:", error);
    // ensure busy flag cleared on unexpected error
    await prisma.instance.update({ where: { id: instanceId }, data: { busy: false } }).catch(() => {});
  }
}