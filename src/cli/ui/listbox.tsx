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
}

export function ListBox({ items, initialIndex = 0, onIndexChange, onBack, onNextPage, onPrevPage }: ListBoxProps) {
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);

  useEffect(() => {
    setSelectedIndex(initialIndex);
  }, [items, initialIndex]);

  useEffect(() => {
    const handleData = (s: string | Buffer) => {
      const data = typeof s === 'string' ? s : s.toString();
      const key = data.trim();
      if (s === '\u0003') {
        // Ctrl+C
        return;
      }
      // Escape or Left arrow or h - go back
      if (key === '\u001b[D' || key === 'h' || key === '\u001b') {
        if (onBack) {
          onBack();
        }
        return;
      }
      if (key === '\u001b[A' || key === 'k') {
        // Up
        setSelectedIndex((prev) => Math.max(0, prev - 1));
      } else if (key === '\u001b[B' || key === 'j') {
        // Down
        setSelectedIndex((prev) => Math.min(items.length - 1, prev + 1));
      } else if (key === '\r' || key === '\n' || key === 'l' || key === '\u001b[C') {
        // Enter or right
        if (items[selectedIndex]) {
          items[selectedIndex].onSelect();
        }
      } else if (key === 'n') {
        // n - next page
        if (onNextPage) {
          onNextPage();
        }
      } else if (key === 'p') {
        // p - prev page
        if (onPrevPage) {
          onPrevPage();
        }
      }
    };

    try {
      process.stdin.setRawMode?.(true);
      process.stdin.resume?.();
      process.stdin.on?.('data', handleData);
    } catch {
      // Raw mode not supported
    }

    return () => {
      try {
        process.stdin.removeListener?.('data', handleData);
      } catch {
        // Ignore
      }
    };
  }, [items, selectedIndex, onBack, onNextPage, onPrevPage]);

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
            <Box width={2}>
              <Text color={isSelected ? 'cyan' : undefined}>
                {isSelected ? '▶' : ' '}
              </Text>
            </Box>
            <Box flexDirection="column" flexGrow={1}>
              <Text color={isSelected ? 'cyan' : undefined} bold={isSelected}>
                • {item.label}
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
