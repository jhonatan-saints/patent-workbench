import { useState } from 'react';
import { Box, Text, Button, Badge, Textarea, Group } from '@mantine/core';
import { IconCheck, IconPencil, IconX } from '@tabler/icons-react';
import type { GeneratedOption } from '@/types';

interface OptionCardProps {
  readonly option: GeneratedOption;
  readonly onSelect: (option: GeneratedOption) => void;
  readonly disabled?: boolean;
}

export function OptionCard({ option, onSelect, disabled }: OptionCardProps) {
  const [editing, setEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(option.content);

  const handleSelect = () => {
    onSelect(editing ? { ...option, content: editedContent } : option);
  };

  const handleEdit = () => {
    setEditedContent(option.content);
    setEditing(true);
  };

  const handleCancelEdit = () => {
    setEditedContent(option.content);
    setEditing(false);
  };

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
          justifyContent: 'space-between',
        }}
      >
        <Badge
          variant="outline"
          style={{
            borderColor: editing ? 'var(--accent)' : 'var(--border)',
            color: editing ? 'var(--accent)' : 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.06em',
          }}
        >
          OPTION {option.index + 1}
          {editing && ' · EDITING'}
        </Badge>

        {editing ? (
          <Button
            variant="subtle"
            size="xs"
            leftSection={<IconX size={11} />}
            onClick={handleCancelEdit}
            style={{
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              height: 24,
              padding: '0 6px',
            }}
          >
            CANCEL
          </Button>
        ) : (
          <Button
            variant="subtle"
            size="xs"
            leftSection={<IconPencil size={11} />}
            onClick={handleEdit}
            disabled={disabled}
            style={{
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              height: 24,
              padding: '0 6px',
            }}
          >
            EDIT
          </Button>
        )}
      </Box>

      {/* Content */}
      <Box
        style={{
          flex: 1,
          padding: editing ? '10px 14px' : '14px',
          overflowY: 'auto',
          maxHeight: 340,
          minHeight: 100,
        }}
      >
        {editing ? (
          <Textarea
            aria-label='Edit option content'
            value={editedContent}
            onChange={(e) => setEditedContent(e.currentTarget.value)}
            minRows={6}
            autosize
            styles={{
              input: {
                background: 'var(--surface)',
                border: '1px solid var(--accent)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-serif)',
                fontSize: 13,
                lineHeight: 1.75,
              },
            }}
          />
        ) : (
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
        )}
      </Box>

      {/* Footer */}
      <Box style={{ padding: '12px 14px', borderTop: '1px solid var(--border)' }}>
        {editing ? (
          <Group gap={8}>
            <Button
              fullWidth
              size="xs"
              onClick={handleSelect}
              disabled={!editedContent.trim() || disabled}
              leftSection={<IconCheck size={12} />}
              style={{
                background: editedContent.trim() ? 'var(--accent)' : 'var(--surface-raised)',
                color: editedContent.trim() ? 'var(--accent-text)' : 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                fontSize: 11,
                letterSpacing: '0.08em',
                border: 'none',
              }}
            >
              SELECT EDITED
            </Button>
          </Group>
        ) : (
          <Button
            fullWidth
            size="xs"
            onClick={handleSelect}
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
        )}
      </Box>
    </Box>
  );
}
