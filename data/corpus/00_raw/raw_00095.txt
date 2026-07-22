import React from 'react';
import { Tag } from 'antd';

/** Default status-to-color mapping */
const DEFAULT_STATUS_CONFIG: Record<string, string> = {
  success: '#52c41a',
  error: '#ff4d4f',
  processing: '#2563eb',
  warning: '#faad14',
};

interface StatusBadgeProps {
  /** Status key or raw value */
  status: string | number | undefined | null;
  /** Custom label override */
  label?: string;
  /** Custom color mapping: maps status value -> Ant Design Tag color name */
  config?: Record<string, string>;
  /** Fallback color when no mapping found */
  fallbackColor?: string;
  /** Style override */
  style?: React.CSSProperties;
}

export default function StatusBadge({
  status,
  label,
  config,
  fallbackColor = 'default',
  style,
}: StatusBadgeProps) {
  const statusStr = String(status ?? '');

  // Use provided config or default
  const colorMap = config ?? DEFAULT_STATUS_CONFIG;
  const color = colorMap[statusStr] ?? fallbackColor;
  const displayLabel = label ?? statusStr;

  if (!displayLabel) return null;

  return (
    <Tag color={color} style={style}>
      {displayLabel}
    </Tag>
  );
}
