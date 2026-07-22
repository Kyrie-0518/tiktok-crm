import React from 'react';
import { Table as AntTable } from 'antd';
import type { TableProps as AntTableProps } from 'antd';

interface TableProps<T = any> extends Omit<AntTableProps<T>, 'pagination'> {
  /** 数据 */
  dataSource: T[];
  /** 列定义 */
  columns: AntTableProps<T>['columns'];
  /** 是否加载中 */
  loading?: boolean;
  /** 表格尺寸 */
  size?: 'small' | 'middle' | 'large';
  /** 分页配置 */
  pagination?: false | {
    pageSize?: number;
    showSizeChanger?: boolean;
    showTotal?: (total: number) => string;
    current?: number;
    total?: number;
    onChange?: (page: number, pageSize: number) => void;
  };
}

/**
 * 统一表格组件
 * 
 * 规范: 表头 13px/#64748B + #FAFBFC 背景 | 内容 14px/#334155 | 行高 64px
 * 
 * 用法:
 * ```tsx
 * <Table dataSource={products} columns={columns} loading={loading} />
 * ```
 */
export default function Table<T = any>({ pagination, ...rest }: TableProps<T>) {
  return (
    <AntTable<T>
      {...rest}
      rowKey={rest.rowKey as string ?? 'id'}
      size={rest.size ?? 'middle'}
      pagination={pagination === false ? false : {
        pageSize: 20,
        showSizeChanger: false,
        showTotal: (t: number) => `共 ${t} 条`,
        ...(pagination ?? {}),
      } as any}
    />
  );
}

/** 全局表格样式 — 在 App.tsx 中一次性注入 */
export const TABLE_CSS = `
  /* 表头 */
  .ant-table-thead > tr > th {
    font-size: var(--bo-table-header-size) !important;
    color: var(--bo-text-secondary) !important;
    background: var(--bo-table-header-bg) !important;
    font-weight: 600 !important;
    padding: 12px 16px !important;
    border-bottom: 1px solid var(--bo-border) !important;
  }
  .ant-table-thead > tr > th::before {
    display: none !important;
  }
  /* 行 */
  .ant-table-tbody > tr > td {
    font-size: var(--bo-table-row-size) !important;
    color: var(--bo-text-primary) !important;
    padding: 12px 16px !important;
    border-bottom: 1px solid var(--bo-border) !important;
  }
  /* hover */
  .ant-table-tbody > tr:hover > td {
    background: var(--bo-page-bg) !important;
  }
  /* 容器 */
  .ant-table-wrapper .ant-table {
    border-radius: var(--bo-radius-lg);
    overflow: hidden;
  }
`;
