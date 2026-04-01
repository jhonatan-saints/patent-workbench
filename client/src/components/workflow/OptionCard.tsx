import { useState } from 'react';
import { Box, Text, Button, Badge, Textarea, Group } from '@mantine/core';
import { IconCheck, IconPencil, IconX } from '@tabler/icons-react';
import { BTN_PRIMARY, BTN_PRIMARY_DISABLED, INPUT_STYLES } from '@/theme/styles';
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
    <Box className={`border rounded-md bg-surface flex flex-col h-full transition-colors duration-150 ${disabled ? 'border-stroke' : 'border-stroke hover:border-accent'}`}>
      {/* Header */}
      <Box className="px-3.5 py-2.5 border-b border-stroke bg-surface-raised rounded-t-md flex items-center justify-between">
        <Badge
          variant="outline"
          className={`font-mono text-[11px] tracking-[0.06em] ${editing ? 'border-accent text-accent' : 'border-stroke text-fg-muted'}`}
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
            className="text-fg-muted font-mono text-[10px] h-6 px-1.5"
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
            className="text-fg-muted font-mono text-[10px] h-6 px-1.5"
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
            aria-label="Edit option content"
            value={editedContent}
            onChange={(e) => setEditedContent(e.currentTarget.value)}
            minRows={6}
            autosize
            styles={{
              input: {
                ...INPUT_STYLES.input,
                border: '1px solid var(--accent)',
                fontFamily: 'var(--font-serif)',
                fontSize: 13,
                lineHeight: 1.75,
              },
            }}
          />
        ) : (
          <Text className="text-fg font-serif text-sm leading-[1.75] whitespace-pre-wrap">
            {option.content}
          </Text>
        )}
      </Box>

      {/* Footer */}
      <Box className="px-3.5 py-3 border-t border-stroke">
        {editing ? (
          <Group gap={8}>
            <Button
              fullWidth
              size="xs"
              onClick={handleSelect}
              disabled={!editedContent.trim() || disabled}
              leftSection={<IconCheck size={12} />}
              style={editedContent.trim() ? BTN_PRIMARY : BTN_PRIMARY_DISABLED}
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
            style={BTN_PRIMARY}
          >
            SELECT THIS OPTION
          </Button>
        )}
      </Box>
    </Box>
  );
}
