import * as SQLite from 'expo-sqlite';
import {
  createCategoriesTableQuery,
  createCategoryDefaultQuery,
  createCategoryTriggerQuery,
} from './tables/CategoryTable';
import {
  createNovelIndexQuery,
  createNovelTableQuery,
  createNovelTriggerQueryDelete,
  createNovelTriggerQueryInsert,
  createNovelTriggerQueryUpdate,
  dropNovelIndexQuery,
} from './tables/NovelTable';
import { createNovelCategoryTableQuery } from './tables/NovelCategoryTable';
import {
  createChapterTableQuery,
  createChapterIndexQuery,
  dropChapterIndexQuery,
} from './tables/ChapterTable';

import { createRepositoryTableQuery } from './tables/RepositoryTable';
import { MMKVStorage } from '@utils/mmkv/mmkv';
import { showToast } from '@utils/showToast';

const dbName = 'lnreader.db';

export const db = SQLite.openDatabaseSync(dbName);

export const createTables = () => {
  const isOnBoard = MMKVStorage.getBoolean('IS_ONBOARDED');

  // These values are not persistent and need to be set on every app start
  db.execSync('PRAGMA busy_timeout = 5000');
  db.execSync('PRAGMA cache_size = 10000');
  db.execSync('PRAGMA foreign_keys = ON');

  const userVersion =
    db.getFirstSync<{ user_version: number }>('PRAGMA user_version')
      ?.user_version ?? 0;

  if (!isOnBoard) {
    db.execSync('PRAGMA journal_mode = WAL');
    db.execSync('PRAGMA synchronous = NORMAL');
    db.execSync('PRAGMA temp_store = MEMORY');
    db.withTransactionSync(() => {
      db.runSync(createNovelTableQuery);
      db.runSync(createNovelIndexQuery);
      db.runSync(createCategoriesTableQuery);
      db.runSync(createCategoryDefaultQuery);
      db.runSync(createNovelCategoryTableQuery);
      db.runSync(createChapterTableQuery);
      db.runSync(createCategoryTriggerQuery);
      db.runSync(createChapterIndexQuery);
      db.runSync(createRepositoryTableQuery);
      db.runSync(`CREATE TABLE IF NOT EXISTS Summaries (
        chapter_id INTEGER PRIMARY KEY,
        summary TEXT,
        updated_at TEXT,
        FOREIGN KEY (chapter_id) REFERENCES Chapter(id) ON DELETE CASCADE
      );`);
      db.runSync(`CREATE TRIGGER IF NOT EXISTS delete_summary_after_chapter_insert
        AFTER INSERT ON Chapter
        BEGIN
          DELETE FROM Summaries WHERE chapter_id = NEW.id;
        END;`);
      db.runSync(`CREATE TRIGGER IF NOT EXISTS delete_summary_after_chapter_update
        AFTER UPDATE ON Chapter
        BEGIN
          DELETE FROM Summaries WHERE chapter_id = NEW.id;
        END;`);
      db.runSync(createNovelTriggerQueryInsert);
      db.runSync(createNovelTriggerQueryUpdate);
      db.runSync(createNovelTriggerQueryDelete);
      db.execSync('PRAGMA user_version = 1');
    });
  } else {
    if (userVersion < 1) {
      updateToDBVersion1();
    }
  }
};

export const recreateDBIndex = () => {
  try {
    db.execSync('PRAGMA analysis_limit=4000');
    db.execSync('PRAGMA optimize');

    db.execSync('PRAGMA journal_mode = WAL');
    db.execSync('PRAGMA foreign_keys = ON');
    db.execSync('PRAGMA synchronous = NORMAL');
    db.execSync('PRAGMA cache_size = 10000');
    db.execSync('PRAGMA temp_store = MEMORY');
    db.execSync('PRAGMA busy_timeout = 5000');
    db.withTransactionSync(() => {
      db.runSync(dropNovelIndexQuery);
      db.runSync(dropChapterIndexQuery);
      db.runSync(createNovelIndexQuery);
      db.runSync(createChapterIndexQuery);
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    showToast(message);
  }
};

function updateToDBVersion1() {
  db.execSync('PRAGMA journal_mode = WAL');
  db.execSync('PRAGMA synchronous = NORMAL');
  db.execSync('PRAGMA temp_store = MEMORY');

  db.withTransactionSync(() => {
    db.runSync(
      'ALTER TABLE Novel ADD COLUMN chaptersDownloaded INTEGER DEFAULT 0',
    );

    db.runSync('ALTER TABLE Novel ADD COLUMN chaptersUnread INTEGER DEFAULT 0');
    db.runSync('ALTER TABLE Novel ADD COLUMN totalChapters INTEGER DEFAULT 0');
    db.runSync('ALTER TABLE Novel ADD COLUMN lastReadAt TEXT');
    db.runSync('ALTER TABLE Novel ADD COLUMN lastUpdatedAt TEXT');
    db.runSync(`UPDATE Novel
      SET chaptersDownloaded = (
          SELECT COUNT(*)
          FROM Chapter
          WHERE Chapter.novelId = Novel.id AND Chapter.isDownloaded = 1
      );
      `);
    db.runSync(`UPDATE Novel
SET chaptersUnread = (
    SELECT COUNT(*)
    FROM Chapter
    WHERE Chapter.novelId = Novel.id AND Chapter.unread = 1
);
`);
    db.runSync(`UPDATE Novel
SET totalChapters = (
    SELECT COUNT(*)
    FROM Chapter
    WHERE Chapter.novelId = Novel.id
);
`);
    db.runSync(`UPDATE Novel
      SET lastReadAt = (
          SELECT MAX(readTime)
          FROM Chapter
          WHERE Chapter.novelId = Novel.id
      );
      `);
    db.runSync(`UPDATE Novel
      SET lastUpdatedAt = (
          SELECT MAX(updatedTime)
          FROM Chapter
          WHERE Chapter.novelId = Novel.id
      );
      `);
    db.runSync(createNovelTriggerQueryInsert);
    db.runSync(createNovelTriggerQueryUpdate);
    db.runSync(createNovelTriggerQueryDelete);
    db.execSync('PRAGMA user_version = 1');
  });
}
