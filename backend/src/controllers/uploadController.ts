import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { execFileSync } from 'child_process';

const ffmpegPath = require('ffmpeg-static') as string;
const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

function convertAudioToMp3(inputPath: string): string {
  const outputPath = inputPath.replace(/\.[^.]+$/, '.mp3');
  execFileSync(ffmpegPath, ['-i', inputPath, '-y', '-codec:a', 'libmp3lame', '-q:a', '2', outputPath]);
  fs.unlinkSync(inputPath);
  return outputPath;
}

export const uploadMedia = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    const ext = path.extname(req.file.originalname) || '.bin';
    const id = crypto.randomUUID();
    const filename = `${id}${ext}`;
    const filepath = path.join(UPLOADS_DIR, filename);

    fs.writeFileSync(filepath, req.file.buffer);

    let finalFilename = filename;
    const isAudio = req.file.mimetype.startsWith('audio/') || ext.toLowerCase() === '.webm';
    const needsConversion = ['.webm', '.weba', '.ogg'].includes(ext.toLowerCase());

    console.log(`Upload: ${req.file.originalname} | mime: ${req.file.mimetype} | ext: ${ext} | convert: ${isAudio && needsConversion}`);

    if (isAudio && needsConversion) {
      try {
        const mp3Path = convertAudioToMp3(filepath);
        finalFilename = path.basename(mp3Path);
      } catch (err) {
        console.error('Erro ao converter audio:', err);
      }
    }

    const baseUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
    const mediaUrl = `${baseUrl}/uploads/${finalFilename}`;

    return res.json({ url: mediaUrl, filename: finalFilename });
  } catch (error) {
    console.error('Erro no upload:', error);
    return res.status(500).json({ error: 'Erro ao fazer upload' });
  }
};
