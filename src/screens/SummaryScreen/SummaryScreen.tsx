import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTheme } from '@hooks/persisted';
import { SummaryScreenProps } from '@navigators/types';
import { fetchOrGenerateSummary } from '@services/SummarizationService';
import { getNovelById } from '@database/queries/NovelQueries';
import { getChapter } from '@database/queries/ChapterQueries';
import { NovelInfo, ChapterInfo } from '@database/types';
import { Button } from '@components';

const SummaryScreen = ({ route, navigation }: SummaryScreenProps) => {
  const { chapterId } = route.params;
  const theme = useTheme();

  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [novel, setNovel] = useState<NovelInfo | null>(null);
  const [chapter, setChapter] = useState<ChapterInfo | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const ch = await getChapter(Number(chapterId));
        if (!ch) {
          throw new Error('Chapter not found');
        }
        setChapter(ch);
        const nov = await getNovelById(ch.novelId);
        if (nov) setNovel(nov);
        const sum = await fetchOrGenerateSummary(String(chapterId));
        setSummary(sum);
      } catch (e) {
        setError('Failed to load summary');
      } finally {
        setLoading(false);
      }
    })();
  }, [chapterId]);

  const openChapter = () => {
    if (novel && chapter) {
      navigation.navigate('ReaderStack', {
        screen: 'Chapter',
        params: { novel, chapter },
      });
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.error }}>{error}</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: theme.background }]}>
      {novel?.cover ? <Image source={{ uri: novel.cover }} style={styles.cover} /> : null}
      {novel ? (
        <Text style={[styles.title, { color: theme.onSurface }]}>{novel.name}</Text>
      ) : null}
      {chapter ? (
        <Text style={[styles.chapter, { color: theme.onSurfaceVariant }]}>{chapter.name}</Text>
      ) : null}
      <View style={styles.summaryContainer}>
        <Text style={{ color: theme.onSurface }} selectable>{summary}</Text>
      </View>
      <Button title="Read Full Chapter" onPress={openChapter} style={styles.button} />
    </ScrollView>
  );
};

export default SummaryScreen;

const styles = StyleSheet.create({
  container: { padding: 16 },
  cover: { width: 150, height: 200, alignSelf: 'center', marginBottom: 16 },
  title: { fontSize: 20, textAlign: 'center', marginBottom: 4 },
  chapter: { fontSize: 16, textAlign: 'center', marginBottom: 16 },
  summaryContainer: { marginTop: 8 },
  button: { marginTop: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
});
