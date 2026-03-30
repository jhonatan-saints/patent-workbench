import { Box, Text, Button, Badge } from '@mantine/core';
import { IconCheck } from '@tabler/icons-react';
import type { GeneratedOption } from '@/types';

interface OptionCardProps {
  readonly option: GeneratedOption;
  readonly onSelect: (option: GeneratedOption) => void;
  readonly disabled?: boolean;
}

export function OptionCard({ option, onSelect, disabled }: OptionCardProps) {
  return (
    <Box
      style={{
        border: '1px solid var(--border)',
        borderRadius: 6,
        background: 'var(--surface)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        transition: 'border-color 0.15s ease',
      }}
      onMouseEnter={(e) => {
        if (!disabled)
          (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
      }}
    >
      {/* Header */}
      <Box
        style={{
          padding: '10px 14px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface-raised)',
          borderRadius: '6px 6px 0 0',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <Badge
          variant="outline"
          style={{
            borderColor: 'var(--border)',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.06em',
          }}
        >
          OPTION {option.index + 1}
        </Badge>
      </Box>

      {/* Content */}
      <Box
        style={{
          flex: 1,
          padding: '14px',
          overflowY: 'auto',
          maxHeight: 340,
          minHeight: 100,
        }}
      >
        <Text
          size="sm"
          style={{
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-serif)',
            lineHeight: 1.75,
            whiteSpace: 'pre-wrap',
          }}
        >
          {option.content}
        </Text>
      </Box>

      {/* Footer */}
      <Box style={{ padding: '12px 14px', borderTop: '1px solid var(--border)' }}>
        <Button
          fullWidth
          size="xs"
          onClick={() => onSelect(option)}
          disabled={disabled}
          leftSection={<IconCheck size={12} />}
          style={{
            background: 'var(--accent)',
            color: 'var(--accent-text)',
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            fontSize: 11,
            letterSpacing: '0.08em',
            border: 'none',
          }}
        >
          SELECT THIS OPTION
        </Button>
      </Box>
    </Box>
  );
}
