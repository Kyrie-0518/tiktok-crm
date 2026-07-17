import React from 'react';
import { Button as AntButton } from 'antd';
import type { ButtonProps as AntButtonProps } from 'antd';

type StatusType = 'primary' | 'default' | 'danger';

interface ButtonProps extends Omit<AntButtonProps, 'type'> {
  /** 按钮类型 */
  variant?: StatusType;
  /** 是否加载中 */
  loading?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
  /** 按钮文本/内容 */
  children?: React.ReactNode;
}

/** variant → antd type 映射 */
const TYPE_MAP: Record<StatusType, AntButtonProps['type']> = {
  primary: 'primary',
  default: 'default',
  danger: 'primary',   // Ant Design 没有 danger type，用 danger prop
};

/**
 * 统一按钮组件
 * 
 * 规范: 36px 高 | 8px 圆角 | #4568FF 主色
 * 
 * 用法:
 * ```tsx
 * <Button variant="primary" icon={<PlusOutlined />}>新增商品</Button>
 * <Button variant="default" icon={<UploadOutlined />}>导入</Button>
 * <Button variant="danger">删除</Button>
 * ```
 */
export default function Button({ variant = 'default', children, loading, disabled, style, ...rest }: ButtonProps) {
  const isDanger = variant === 'danger';

  return (
    <AntButton
      {...rest}
      type={isDanger ? 'primary' : TYPE_MAP[variant] as AntButtonProps['type']}
      danger={isDanger}
      loading={loading}
      disabled={disabled}
      style={{
        height: 'var(--bo-btn-height)',
        padding: `0 var(--bo-btn-padding-x)`,
        borderRadius: 'var(--bo-btn-radius)',
        fontWeight: 500,
        fontSize: 14,
        ...(variant === 'default' && { border: '1px solid #DCE3F0', color: 'var(--bo-text-primary)' }),
        ...(variant === 'primary' && { background: 'var(--bo-primary)', borderColor: 'var(--bo-primary)', boxShadow: '0 2px 4px rgba(69,104,255,0.2)' }),
        ...style,
      }}
    >
      {children}
    </AntButton>
  );
}
