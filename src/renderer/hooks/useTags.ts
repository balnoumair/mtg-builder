import { useState, useEffect, useCallback } from 'react';
import type { Tag } from '../../shared/types';

export function useTags() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setTags(await window.electronAPI.getTags());
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const createTag = useCallback(async (name: string) => {
    const tag = await window.electronAPI.createTag({ name });
    await refresh();
    return tag;
  }, [refresh]);

  const updateTag = useCallback(async (id: number, updates: { name?: string; color?: string }) => {
    await window.electronAPI.updateTag(id, updates);
    await refresh();
  }, [refresh]);

  const deleteTag = useCallback(async (id: number) => {
    await window.electronAPI.deleteTag(id);
    await refresh();
  }, [refresh]);

  return { tags, loading, createTag, updateTag, deleteTag, refresh };
}
