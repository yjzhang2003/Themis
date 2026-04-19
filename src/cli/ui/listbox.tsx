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
  // Keep refs to latest values to avoid stale closures
  const itemsRef = useRef(items);
  const selectedIndexRef = useRef(selectedIndex);

  // Keep refs updated
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    selectedIndexRef.current = selectedIndex;
  }, [selectedIndex]);

  // Only reset when initialIndex changes externally (like pagination)
  useEffect(() => {
    if (initialIndex !== initialIndexRef.current) {
      setSelectedIndex(initialIndex);
      initialIndexRef.current = initialIndex;
    }
  }, [initialIndex]);

  // Set up key listener
  useEffect(() => {
    const isTTY = process.stdin.isTTY;

    if (!isTTY) {
      setKeyHandler(null);
      return;
    }

    const handler = (s: string | Buffer) => {
      const data = typeof s === 'string' ? s : s.toString();
      const currentItems = itemsRef.current;
      const currentIndex = selectedIndexRef.current;

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
        setSelectedIndex((prev) => Math.min(currentItems.length - 1, prev + 1));
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
        if (multiSelect && currentItems[currentIndex] && onToggleSelect) {
          onToggleSelect(currentItems[currentIndex].id);
          setSelectedIndex((prev) => Math.min(currentItems.length - 1, prev + 1));
        }
        return;
      }

      // Enter - confirm and go to next step, or toggle if no onConfirm
      if (data === '\r' || data === '\n') {
        if (multiSelect && onConfirm) {
          // Enter confirms and goes to next step
          if (selectedIds.length > 0) {
            onConfirm();
          }
        } else if (currentItems[currentIndex]) {
          if (multiSelect && onToggleSelect) {
            // No onConfirm, so Enter toggles selection
            onToggleSelect(currentItems[currentIndex].id);
            setSelectedIndex((prev) => Math.min(currentItems.length - 1, prev + 1));
          } else {
            currentItems[currentIndex].onSelect();
          }
        }
        return;
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
  }, [onBack, onNextPage, onPrevPage, multiSelect, onToggleSelect]);

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
        const isSelected = !!(index === selectedIndex && keyHandler);
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
