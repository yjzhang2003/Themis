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
  onIndexChange?: (index: number) => void;
}

export function ListBox({ items, onIndexChange }: ListBoxProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  useEffect(() => {
    onIndexChange?.(selectedIndex);
  }, [selectedIndex, onIndexChange]);

  useEffect(() => {
    const handleData = (s: string | Buffer) => {
      const data = typeof s === 'string' ? s : s.toString();
      const key = data.trim();
      if (s === '\u0003') {
        // Ctrl+C
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
        process.stdin.setRawMode?.(false);
      } catch {
        // Ignore
      }
    };
  }, [items, selectedIndex]);

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
              {item.description && (
                <Text dimColor>{item.description}</Text>
              )}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
