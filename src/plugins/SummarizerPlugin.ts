import * as FileSystem from 'expo-file-system';

const STORAGE_DIR =
  (FileSystem.documentDirectory ?? FileSystem.cacheDirectory) + 'summaries';

export default class SummarizerPlugin {
  /**
   * Initialize the cache directory used for storing chapter summaries.
   */
  async initialize(): Promise<void> {
    const dir = await FileSystem.getInfoAsync(STORAGE_DIR);
    if (!dir.exists) {
      await FileSystem.makeDirectoryAsync(STORAGE_DIR, {
        intermediates: true,
      });
    }
  }

  /**
   * Return a summary for the given chapter. If the summary is cached it is
   * returned from storage otherwise a placeholder summary is generated and
   * cached before returning.
   */
  async summarizeChapter(chapterId: string): Promise<string> {
    const filePath = `${STORAGE_DIR}/${chapterId}.txt`;
    const info = await FileSystem.getInfoAsync(filePath);
    if (info.exists) {
      return FileSystem.readAsStringAsync(filePath, {
        encoding: FileSystem.EncodingType.UTF8,
      });
    }

    const summary = `Summary for chapter ${chapterId}`;
    await FileSystem.writeAsStringAsync(filePath, summary, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    return summary;
  }

  /**
   * Remove the cached summary for a given chapter, if any exists.
   */
  async invalidateCache(chapterId: string): Promise<void> {
    const filePath = `${STORAGE_DIR}/${chapterId}.txt`;
    const info = await FileSystem.getInfoAsync(filePath);
    if (info.exists) {
      await FileSystem.deleteAsync(filePath, { idempotent: true });
    }
  }
}
