import React, { useState, useEffect, useRef } from 'react';
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
  onConfirm?: () => void;
}

export function ListBox({
  items,
  initialIndex = 0,
  onBack,
  onNextPage,
  onPrevPage,
  multiSelect = false,
  selectedIds = [],
  onToggleSelect,
  onConfirm,
}: ListBoxProps) {
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);
  const [keyHandler, setKeyHandler] = useState<((key: string) => void) | null>(null);
  const initialIndexRef = useRef(initialIndex);

  // Only reset when key changes (indicating different list content, like pagination)
  useEffect(() => {
    if (keyHandler === null) {
      // First mount - use current initialIndex
    } else if (initialIndex !== initialIndexRef.current) {
      // initialIndex changed externally (like pagination) - reset cursor
      setSelectedIndex(initialIndex);
      initialIndexRef.current = initialIndex;
    }
  }, [initialIndex, keyHandler]);

  // Set up key listener similar to menu.tsx
  useEffect(() => {
    const isTTY = process.stdin.isTTY;

    if (!isTTY) {
      setKeyHandler(null);
      return;
    }

    const handler = (s: string | Buffer) => {
      const data = typeof s === 'string' ? s : s.toString();

      // Ctrl+C
      if (s === '\u0003') {
        return;
      }

      // Escape - go back
      if (data === '\u001b') {
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

      // Space - toggle selection
      if (data === ' ') {
        if (multiSelect && items[selectedIndex] && onToggleSelect) {
          onToggleSelect(items[selectedIndex].id);
          setSelectedIndex((prev) => Math.min(items.length - 1, prev + 1));
        }
        return;
      }

      // Enter - select current item
      if (data === '\r' || data === '\n') {
        if (items[selectedIndex]) {
          if (multiSelect) {
            // In multi-select mode, Enter toggles current item selection
            if (onToggleSelect) {
              onToggleSelect(items[selectedIndex].id);
              // Move to next item after selection
              setSelectedIndex((prev) => Math.min(items.length - 1, prev + 1));
            }
          } else {
            items[selectedIndex].onSelect();
          }
        }
        return;
      }

      // Ctrl+Enter - confirm selection in multi-select mode
      if (data === '\r\n' || data === '\n\r' || s === '\x1b\r' || s === '\r\x1b') {
        if (multiSelect && selectedIds.length > 0 && onConfirm) {
          onConfirm();
          return;
        }
      }
    };

    try {
      process.stdin.setRawMode?.(true);
      process.stdin.resume?.();
      process.stdin.setEncoding?.('utf8');
      process.stdin.on?.('data', handler);
      setKeyHandler(() => handler);
    } catch {
      setKeyHandler(null);
    }

    return () => {
      try {
        process.stdin.removeListener?.('data', handler);
        process.stdin.setRawMode?.(false);
      } catch {
        // Ignore cleanup errors
      }
    };
  }, [items, onBack, onNextPage, onPrevPage, multiSelect, onToggleSelect]);

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
        const isSelected = index === selectedIndex && keyHandler;
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
