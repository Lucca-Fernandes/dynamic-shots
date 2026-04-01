import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export async function bulkSend(req: Request, res: Response) {
  const { instanceId, message, leads, numbers, delayMin = 20, delayMax = 40, mediaType = 'text', mediaUrl } = req.body;

  let normalizedLeads: { phone: string; name?: string; variables?: Record<string, string> }[];
  if (Array.isArray(leads) && leads.length > 0) {
    normalizedLeads = leads.map((lead: any) => {
      const { phone, name, nome, variables, ...rest } = lead;
      return {
        phone: String(phone || '').replace(/\D/g, ''),
        name: name || nome,
        variables: { ...rest, ...(variables || {}), ...(nome ? { nome } : {}), ...(name ? { name } : {}) }
      };
    });
  } else if (Array.isArray(numbers) && numbers.length > 0) {
    normalizedLeads = numbers.map((n: string) => ({ phone: n.replace(/\D/g, '') }));
  } else {
    return res.status(400).json({ error: 'Envie "leads" ou "numbers" no body' });
  }

  normalizedLeads = normalizedLeads.filter(l => l.phone.length >= 10);
  if (normalizedLeads.length === 0) {
    return res.status(400).json({ error: 'Nenhum lead valido encontrado' });
  }

  try {
    const instance = await prisma.instance.findUnique({ where: { id: instanceId } });
    if (!instance) return res.status(404).json({ error: "Instancia nao encontrada" });
    if ((req as any).userId !== instance.ownerId) {
      return res.status(403).json({ error: 'Nao autorizado' });
    }

    const minDelay = Math.max(10, Math.min(120, Number(delayMin) || 20));
    const maxDelay = Math.max(minDelay, Math.min(120, Number(delayMax) || 40));

    const campaign = await prisma.campaign.create({
      data: {
        name: `Disparo rapido - ${new Date().toLocaleString('pt-BR')}`,
        message,
        mediaType,
        mediaUrl: mediaUrl || null,
        delayMin: minDelay,
        delayMax: maxDelay,
        totalLeads: normalizedLeads.length,
        status: 'SENDING',
        startedAt: new Date(),
        ownerId: (req as any).userId,
        instanceId,
        leads: {
          create: normalizedLeads.map(lead => ({
            phone: lead.phone,
            name: lead.name,
            variables: lead.variables || {}
          }))
        }
      }
    });

    return res.status(202).json({ message: "Disparo iniciado com sucesso", campaignId: campaign.id });
  } catch (error) {
    console.error("Erro no controlador de disparo:", error);
    return res.status(500).json({ error: 'Erro interno no disparo' });
  }
}
