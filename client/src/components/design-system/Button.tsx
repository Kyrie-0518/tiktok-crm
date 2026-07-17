import React from 'react';
import { Button as AntButton } from 'antd';

type StatusType = 'primary' | 'default' | 'danger' | 'link' | 'text';

interface ButtonProps {
  /** 按钮类型 */
  variant?: StatusType;
  /** 是否加载中 */
  loading?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
  /** 按钮文本/内容 */
  children?: React.ReactNode;
  /** 按钮图标 */
  icon?: React.ReactNode;
  /** 点击事件 */
  onClick?: (e: React.MouseEvent<HTMLElement>) => void;
  /** 自定义样式 */
  style?: React.CSSProperties;
  /** size */
  size?: 'small' | 'middle' | 'large';
  /** 块级 */
  block?: boolean;
  /** htmlType */
  htmlType?: 'button' | 'submit' | 'reset';
  /** className */
  className?: string;
  /** title */
  title?: string;
}

/**
 * 统一按钮组件
 *
 * 规范: 36px 高 | 8px 圆角 | #4568FF 主色
 */
export default function Button({
  variant = 'default',
  children,
  loading,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const isDanger = variant === 'danger';

  // 合并样式
  const finalStyle: React.CSSProperties = {
    height: variant === 'default' || variant === 'primary' || variant === 'danger' ? 'var(--bo-btn-height)' : undefined,
    padding: variant === 'default' || variant === 'primary' || variant === 'danger' ? `0 var(--bo-btn-padding-x)` : undefined,
    borderRadius: 'var(--bo-btn-radius)',
    fontWeight: 500,
    fontSize: 14,
    ...(variant === 'default' && { border: '1px solid #DCE3F0', color: 'var(--bo-text-primary)' }),
    ...(variant === 'primary' && {
      background: 'var(--bo-primary)',
      borderColor: 'var(--bo-primary)',
      boxShadow: '0 2px 4px rgba(69,104,255,0.2)',
    }),
    ...style,
  };

  return (
    <AntButton
      {...rest}
      type={isDanger ? 'primary' : (variant as any)}
      danger={isDanger}
      loading={loading}
      disabled={disabled}
      style={finalStyle}
    >
      {children}
    </AntButton>
  );
}
