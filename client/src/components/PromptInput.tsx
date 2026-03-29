import { Textarea, Select, Group, Text, Button, Stack, Badge, Box } from '@mantine/core';
import { IconSparkles, IconLoader2 } from '@tabler/icons-react';
import { useWorkbenchStore } from '../store/workbench';
import { estimateTokens } from '../utils/templates';

const MAX_PROMPT_LENGTH = 4000;

// "llama3.2:latest" -> "llama3.2"
function formatModelLabel(name: string): string {
  return name.split(':')[0];
}

export function PromptInput() {
  const {
    currentPrompt,
    setPrompt,
    selectedModel,
    setModel,
    availableModels,
    generationStatus,
    generate,
    llmStatus,
  } = useWorkbenchStore();

  const isLoading = generationStatus === 'loading';
  const isDisabled = isLoading || llmStatus !== 'ok';
  const tokenCount = estimateTokens(currentPrompt);
  const charCount = currentPrompt.length;
  const overLimit = charCount > MAX_PROMPT_LENGTH;

  return (
    <Stack gap={12}>
      {/* Model + Token Header */}
      <Group justify="space-between">
        <Select
          size="xs"
          value={selectedModel}
          onChange={(v) => v && setModel(v)}
          data={availableModels.map((m) => ({ value: m, label: formatModelLabel(m) }))}
          style={{ width: 160 }}
          styles={{
            input: {
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            },
            dropdown: {
              background: 'var(--surface)',
              border: '1px solid var(--border)',
            },
          }}
        />

        <Group gap={8}>
          <Badge
            variant="outline"
            size="xs"
            style={{
              borderColor: overLimit ? '#f87171' : 'var(--border)',
              color: overLimit ? '#f87171' : 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
            }}
          >
            {charCount}/{MAX_PROMPT_LENGTH}
          </Badge>
          <Badge
            variant="outline"
            size="xs"
            style={{
              borderColor: 'var(--border)',
              color: 'var(--accent)',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
            }}
          >
            ~{tokenCount} tokens
          </Badge>
        </Group>
      </Group>

      {/* Textarea */}
      <Textarea
        value={currentPrompt}
        onChange={(e) => setPrompt(e.currentTarget.value)}
        placeholder="Enter your patent prompt or select a section template above..."
        minRows={12}
        maxRows={20}
        autosize
        styles={{
          input: {
            background: 'var(--surface)',
            border: overLimit ? '1px solid #f87171' : '1px solid var(--border)',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            lineHeight: 1.7,
            resize: 'vertical',
            '&:focus': {
              borderColor: 'var(--accent)',
            },
          },
        }}
      />

      {/* Generate Button */}
      <Box>
        <Button
          onClick={generate}
          disabled={isDisabled || !currentPrompt.trim() || overLimit}
          loading={isLoading}
          fullWidth
          size="md"
          leftSection={
            isLoading ? <IconLoader2 size={16} className="spin" /> : <IconSparkles size={16} />
          }
          style={{
            background: isDisabled ? 'var(--surface)' : 'var(--accent)',
            color: isDisabled ? 'var(--text-muted)' : '#0d0d0d',
            border: `1px solid ${isDisabled ? 'var(--border)' : 'var(--accent)'}`,
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            letterSpacing: '0.05em',
            fontSize: 13,
            transition: 'all 0.2s ease',
          }}
        >
          {isLoading ? 'GENERATING...' : 'GENERATE'}
        </Button>

        {llmStatus === 'unavailable' && (
          <Text size="xs" c="red" mt={6} ta="center">
            LLM is offline. Start Ollama and refresh status.
          </Text>
        )}
      </Box>
    </Stack>
  );
}
