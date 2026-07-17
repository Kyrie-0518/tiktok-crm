import React from 'react';
import { Card as AntCard, Typography } from 'antd';
import type { CardProps as AntCardProps } from 'antd';

const { Text } = Typography;

interface CardProps extends AntCardProps {
  /** Card 标题 */
  title?: React.ReactNode;
  /** 标题右侧操作区 */
  extra?: React.ReactNode;
  /** 是否显示顶部分隔线 */
  headerDivider?: boolean;
}

/**
 * 统一卡片组件
 * 
 * 规范: 12px圆角 | 白色背景 | EEF1F6 边框 | 轻阴影
 */
export default function Card({ title, extra, headerDivider, children, ...rest }: CardProps) {
  const headerStyle: React.CSSProperties = headerDivider
    ? { borderBottom: '1px solid var(--bo-border)' }
    : {};

  return (
    <AntCard
      {...rest}
      title={
        title ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            {typeof title === 'string' ? (
              <Text strong style={{ fontSize: 'var(--bo-card-title-size)', fontWeight: 'var(--bo-card-title-weight)', color: 'var(--bo-text-title)' }}>
                {title}
              </Text>
            ) : title}
            {extra && <div>{extra}</div>}
          </div>
        ) : undefined
      }
      extra={!title ? extra : undefined}
      style={{
        borderRadius: 'var(--bo-radius-lg)',
        border: '1px solid var(--bo-border)',
        boxShadow: 'var(--bo-shadow-sm)',
        ...rest.style,
      }}
      styles={{
        header: {
          padding: 'var(--bo-card-padding) var(--bo-card-padding) 0 var(--bo-card-padding)',
          borderBottom: 'none',
          ...headerStyle,
          minHeight: 'unset',
        },
      }}
      bodyStyle={{
        padding: 'var(--bo-card-padding)',
        ...rest.bodyStyle,
      }}
    >
      {children}
    </AntCard>
  );
}
