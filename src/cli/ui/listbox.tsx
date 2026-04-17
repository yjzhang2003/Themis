import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text } from 'ink';

export interface SelectableItem {
  id: string;
  label: string;
  description?: string;
  onSelect: () => void;
}

export interface ListBoxProps {
  items: SelectableItem[];
  initialIndex?: number;
  onIndexChange?: (index: number) => void;
  onBack?: () => void;
  onNextPage?: () => void;
  onPrevPage?: () => void;
  multiSelect?: boolean;
  selectedIds?: string[];
  onToggleSelect?: (id: string) => void;
}

export function ListBox({
  items,
  initialIndex = 0,
  onIndexChange,
  onBack,
  onNextPage,
  onPrevPage,
  multiSelect = false,
  selectedIds = [],
  onToggleSelect,
}: ListBoxProps) {
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);

  useEffect(() => {
    setSelectedIndex(initialIndex);
  }, [items, initialIndex]);

  const handleToggleSelect = useCallback(
    (id: string) => {
      if (onToggleSelect && multiSelect) {
        onToggleSelect(id);
        // Move to next item after selection
        setSelectedIndex((prev) => Math.min(items.length - 1, prev + 1));
      }
    },
    [onToggleSelect, multiSelect, items.length]
  );

  useEffect(() => {
    // Set raw mode for terminal input
    try {
      process.stdin.setRawMode?.(true);
    } catch {
      // Raw mode not supported
    }

    const handleData = (s: string | Buffer) => {
      const data = typeof s === 'string' ? s : s.toString();
      const key = data.trim();
      const rawKey = data;

      if (s === '\u0003') {
        // Ctrl+C - always exit
        return;
      }

      // Escape - go back
      if (key === '\u001b') {
        if (onBack) {
          onBack();
        }
        return;
      }

      // Arrow Up or k - move up
      if (key === '\u001b[A' || key === 'k') {
        setSelectedIndex((prev) => Math.max(0, prev - 1));
        return;
      }

      // Arrow Down or j - move down
      if (key === '\u001b[B' || key === 'j') {
        setSelectedIndex((prev) => Math.min(items.length - 1, prev + 1));
        return;
      }

      // Arrow Left or n - previous page
      if (rawKey === '\u001b[D' || key === 'n') {
        if (onPrevPage) {
          onPrevPage();
        }
        return;
      }

      // Arrow Right or l - next page
      if (rawKey === '\u001b[C' || key === 'l') {
        if (onNextPage) {
          onNextPage();
        }
        return;
      }

      // Space - toggle selection (multi-select mode)
      if (key === ' ') {
        if (multiSelect && items[selectedIndex]) {
          handleToggleSelect(items[selectedIndex].id);
        }
        return;
      }

      // Enter - confirm selection
      if (key === '\r' || key === '\n') {
        if (items[selectedIndex]) {
          items[selectedIndex].onSelect();
        }
        return;
      }
    };

    try {
      process.stdin.resume?.();
      process.stdin.on?.('data', handleData);
    } catch {
      // Resume/input not supported
    }

    return () => {
      try {
        process.stdin.removeListener?.('data', handleData);
        process.stdin.setRawMode?.(false);
      } catch {
        // Ignore
      }
    };
  }, [items, selectedIndex, onBack, onNextPage, onPrevPage, multiSelect, handleToggleSelect]);

  if (items.length === 0) {
    return (
      <Box padding={1}>
        <Text dimColor>(No items)</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {items.map((item, index) => {
        const isSelected = index === selectedIndex;
        const isMultiSelected = selectedIds.includes(item.id);
        // Truncate description to max width (terminal width minus prefix and padding)
        const maxDescWidth = 60;
        const descText = item.description?.split('\n')[0] || '';
        const truncatedDesc = descText.length > maxDescWidth
          ? descText.substring(0, maxDescWidth - 3) + '...'
          : descText;
        return (
          <Box
            key={item.id}
            paddingY={0}
            onSelect={() => {
              setSelectedIndex(index);
              // Small delay to allow visual feedback
              setTimeout(() => item.onSelect(), 50);
            }}
          >
            <Box width={3}>
              <Text color={isSelected ? 'cyan' : undefined}>
                {isMultiSelected ? '◉ ' : isSelected ? '▶ ' : '  '}
              </Text>
            </Box>
            <Box flexDirection="column" flexGrow={1}>
              <Text color={isSelected ? 'cyan' : undefined} bold={isSelected}>
                {item.label}
              </Text>
              {truncatedDesc && (
                <Text dimColor>{truncatedDesc}</Text>
              )}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
