import { useRef, useState } from 'react';
import { useWorkbenchStore } from '@/store/workbench';
import { generatePatentContent } from '@/api/client';
import { buildArtifactContext } from '@/utils/workflowTemplates';

const TITLE_PROMPT_PREFIX =
  'You are a patent title writer. Based on the invention below, generate a single concise and professional patent title (typically 5\u201315 words). Output ONLY the title text, with no quotes, no punctuation at the end, and no explanation.\n\n';

export function useGenerateTitle(onSuccess?: (title: string) => void) {
  const { artifact } = useWorkbenchStore();
  const [generating, setGenerating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const generate = async () => {
    if (generating) {
      abortRef.current?.abort();
      setGenerating(false);
      return;
    }
    if (!artifact) return;
    abortRef.current = new AbortController();
    setGenerating(true);
    try {
      const context = buildArtifactContext(artifact);
      const result = await generatePatentContent(
        { prompt: `${TITLE_PROMPT_PREFIX}${context}`, model: artifact.model },
        abortRef.current.signal
      );
      if (result.success) {
        onSuccess?.(result.data.response.trim());
      }
    } finally {
      setGenerating(false);
    }
  };

  return { generating, generate };
}
