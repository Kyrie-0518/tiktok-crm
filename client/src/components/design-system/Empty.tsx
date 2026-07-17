import React from 'react';
import { Empty as AntEmpty, Button as AntButton, Typography } from 'antd';
import { InboxOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface EmptyProps {
  /** 空状态描述 */
  description?: string;
  /** 操作按钮文字（不传则不显示按钮） */
  actionText?: string;
  /** 操作按钮回调 */
  onAction?: () => void;
}

/**
 * 统一空状态组件
 * 
 * 规范: 64px 图标 | 14px 描述 | 可选主色 CTA 按钮
 */
export default function Empty({ description = '暂无数据', actionText, onAction }: EmptyProps) {
  return (
    <AntEmpty
      image={<InboxOutlined style={{ fontSize: 64, color: 'var(--bo-text-weak)' }} />}
      description={
        <div>
          <Text style={{ fontSize: 14, color: 'var(--bo-text-secondary)', display: 'block', marginBottom: actionText ? 16 : 0 }}>
            {description}
          </Text>
          {actionText && onAction && (
            <AntButton
              type="primary"
              onClick={onAction}
              style={{
                height: 'var(--bo-btn-height)',
                borderRadius: 'var(--bo-btn-radius)',
                background: 'var(--bo-primary)',
              }}
            >
              {actionText}
            </AntButton>
          )}
        </div>
      }
      style={{ padding: '64px 0' }}
    />
  );
}
