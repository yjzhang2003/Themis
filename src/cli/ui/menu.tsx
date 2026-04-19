import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text } from 'ink';

export interface MenuItem {
  id: string;
  label: string;
  description?: string;
}

interface MenuProps {
  title: string;
  items: MenuItem[];
  onSelect: (item: MenuItem) => void;
  onBack?: () => void;
  onQuit?: () => void;
}

export function Menu({ title, items, onSelect, onBack, onQuit }: MenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [keyHandler, setKeyHandler] = useState<((key: string) => void) | null>(null);

  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  // Set up key listener if we have a terminal
  useEffect(() => {
    const isTTY = process.stdin.isTTY;

    if (!isTTY) {
      // No terminal - use click-only mode
      setKeyHandler(null);
      return;
    }

    const handler = (s: string | Buffer) => {
      const data = typeof s === 'string' ? s : s.toString();
      const key = data.trim();
      if (!key) return;

      // Ctrl+C
      if (s === '\u0003') {
        if (onQuit) onQuit();
        return;
      }

      switch (key) {
        case 'q':
        case 'Q':
          if (onQuit) onQuit();
          break;
        case '\u001b[A': // Up arrow
        case 'k':
          setSelectedIndex((prev) => Math.max(0, prev - 1));
          break;
        case '\u001b[B': // Down arrow
        case 'j':
          setSelectedIndex((prev) => Math.min(items.length - 1, prev + 1));
          break;
        case '\r': // Enter
        case '\n':
        case 'l': // right arrow (vim-style)
        case '\u001b[C':
          if (items[selectedIndex]) {
            onSelect(items[selectedIndex]);
          }
          break;
        case '\u001b[D': // Left arrow (vim-style)
        case 'h':
          if (onBack) onBack();
          break;
        case '\u001b': // Escape
          if (onBack) onBack();
          break;
      }
    };

    try {
      process.stdin.setRawMode?.(true);
      process.stdin.resume?.();
      process.stdin.setEncoding?.('utf8');
      process.stdin.on?.('data', handler);
      setKeyHandler(() => handler);
    } catch {
      // Raw mode not supported
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
  }, [items, onSelect, onBack, onQuit]);

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold>{title}</Text>
      </Box>
      <Box flexDirection="column">
        {items.map((item, index) => {
          const isSelected = !!(index === selectedIndex && keyHandler);

          return (
            <Box key={item.id} flexDirection="column">
              <Box>
                <Text color={isSelected ? 'cyan' : undefined}>
                  {isSelected ? <Text color="cyan">▶ </Text> : <Text>  </Text>}
                </Text>
                <Text
                  color={isSelected ? 'cyan' : undefined}
                  bold={isSelected}
                >
                  • {item.label}
                </Text>
              </Box>
              {item.description && (
                <Text dimColor>{item.description}</Text>
              )}
            </Box>
          );
        })}
      </Box>
      <Box marginTop={1} flexDirection="column">
        {keyHandler ? (
          <Text dimColor>[↑↓] Navigate  [Enter] Select  [←] Back  [q] Quit</Text>
        ) : (
          <Text dimColor>[↑↓] Navigate (run in terminal for keyboard control)</Text>
        )}
      </Box>
    </Box>
  );
}

export function ConfirmDialog({
  message,
  onConfirm,
  onCancel,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Box flexDirection="column" padding={1}>
      <Text>{message}</Text>
      <Box marginTop={1}>
        <Text>
          <Text color="cyan">[N]</Text> No  <Text color="cyan">[Y]</Text> Yes
        </Text>
      </Box>
      <Text dimColor>[y] Confirm  [n] Cancel  [q] Quit</Text>
    </Box>
  );
}
