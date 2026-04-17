import React, { useState, useEffect } from 'react';
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

  // Handle keyboard input via readline-like interface
  useEffect(() => {
    if (typeof process.stdin.on === 'function') {
      const handleKeypress = (s: string | Buffer) => {
        const data = typeof s === 'string' ? s : s.toString();

        if (data === '\u0003') {
          // Ctrl+C
          return;
        }

        // Escape - go back
        if (data === '\u001b' || data === '\u001b[D') {
          if (onBack) onBack();
          return;
        }

        // Arrow Up or k
        if (data === '\u001b[A' || data === 'k') {
          setSelectedIndex((prev) => Math.max(0, prev - 1));
          return;
        }

        // Arrow Down or j
        if (data === '\u001b[B' || data === 'j') {
          setSelectedIndex((prev) => Math.min(items.length - 1, prev + 1));
          return;
        }

        // Arrow Left or n - prev page
        if (data === '\u001b[D' || data === 'n') {
          if (onPrevPage) onPrevPage();
          return;
        }

        // Arrow Right or l - next page
        if (data === '\u001b[C' || data === 'l') {
          if (onNextPage) onNextPage();
          return;
        }

        // Space - toggle multi-select
        if (data === ' ') {
          if (multiSelect && items[selectedIndex] && onToggleSelect) {
            onToggleSelect(items[selectedIndex].id);
            setSelectedIndex((prev) => Math.min(items.length - 1, prev + 1));
          }
          return;
        }

        // Enter - select
        if (data === '\r' || data === '\n') {
          if (items[selectedIndex]) {
            items[selectedIndex].onSelect();
          }
          return;
        }
      };

      try {
        process.stdin.setRawMode?.(true);
        process.stdin.on?.('keypress', handleKeypress);
      } catch {
        // stdin not available
      }

      return () => {
        try {
          process.stdin.removeListener?.('keypress', handleKeypress);
          process.stdin.setRawMode?.(false);
        } catch {
          // ignore
        }
      };
    }
  }, [items, selectedIndex, onBack, onNextPage, onPrevPage, multiSelect, onToggleSelect]);

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
