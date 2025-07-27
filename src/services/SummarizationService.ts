import { db } from '@database/db';
import { fetchChapter } from '@services/plugin/fetch';
import NativeFile from '@specs/NativeFile';
import { NOVEL_STORAGE } from '@utils/Storages';
import { Configuration, OpenAIApi } from 'openai';

const openai = new OpenAIApi(
  new Configuration({ apiKey: process.env.OPENAI_API_KEY }),
);

export const fetchOrGenerateSummary = async (
  chapterId: string,
): Promise<string> => {
  const existing = db.getFirstSync<{ summary: string }>(
    'SELECT summary FROM Summaries WHERE chapter_id = ?',
    Number(chapterId),
  );
  if (existing?.summary) {
    return existing.summary;
  }

  const info = db.getFirstSync<{
    path: string;
    novelId: number;
    isDownloaded: number;
    pluginId: string;
  }>(
    `SELECT Chapter.path, Chapter.novelId, Chapter.isDownloaded, Novel.pluginId
       FROM Chapter JOIN Novel ON Chapter.novelId = Novel.id
       WHERE Chapter.id = ?`,
    Number(chapterId),
  );
  if (!info) {
    throw new Error('Chapter not found');
  }

  let text = '';
  const filePath = `${NOVEL_STORAGE}/${info.pluginId}/${info.novelId}/${chapterId}/index.html`;
  if (info.isDownloaded && NativeFile.exists(filePath)) {
    text = NativeFile.readFile(filePath);
  } else {
    text = await fetchChapter(info.pluginId, info.path);
  }

  const response = await openai.createCompletion({
    model: 'text-davinci-003',
    prompt: `Summarize the following chapter:\n${text}\n`,
    max_tokens: 150,
  });
  const summary = response.data.choices[0].text?.trim() ?? '';

  await db.runAsync(
    "INSERT OR REPLACE INTO Summaries (chapter_id, summary, updated_at) VALUES (?, ?, datetime('now'))",
    Number(chapterId),
    summary,
  );

  return summary;
};

export default fetchOrGenerateSummary;
