import React from 'react';
import { Table } from 'antd';
import type { TableProps } from 'antd/es/table';

interface DataTableProps<T = any> extends Omit<TableProps<T>, 'pagination'> {
  dataSource: T[];
  columns: TableProps<T>['columns'];
  loading?: boolean;
  rowKey?: string | ((record: T) => string);
  scroll?: { x?: number | string; y?: number | string };
  size?: 'small' | 'middle' | 'large';
  rowClassName?: string | ((record: T, index: number) => string) | undefined;
  /** Client-side pagination config (omit for server pagination) */
  pagination?: false | {
    pageSize?: number;
    showSizeChanger?: boolean;
    showTotal?: (total: number, range?: [number, number]) => React.ReactNode;
    current?: number;
    total?: number;
    onChange?: (page: number, pageSize: number) => void;
  };
  /** Server pagination mode - pass this to override default client pagination */
  serverPagination?: {
    current: number;
    total: number;
    onChange: (page: number) => void;
  };
}

function buildPagination(props: DataTableProps): Exclude<DataTableProps['pagination'], undefined> | false {
  if (props.pagination === false) return false;

  // Server pagination mode
  if (props.serverPagination) {
    const sp = props.serverPagination;
    return {
      current: sp.current,
      pageSize: 20,
      total: sp.total,
      showSizeChanger: false,
      showTotal: (t: number) => `共 ${t} 条`,
      onChange: sp.onChange,
    };
  }

  // Client pagination mode
  const pg = props.pagination ?? {};
  return {
    pageSize: pg.pageSize ?? 20,
    showSizeChanger: pg.showSizeChanger ?? true,
    showTotal: pg.showTotal ?? ((t: number) => `共 ${t} 条`),
    ...(pg.current !== undefined && { current: pg.current }),
    ...(pg.total !== undefined && { total: pg.total }),
    ...(pg.onChange !== undefined && { onChange: pg.onChange }),
  } as any;
}

export default function DataTable<T = any>(props: DataTableProps<T>) {
  const { serverPagination, ...rest } = props;

  return (
    <Table<T>
      {...rest}
      rowKey={props.rowKey ?? 'id'}
      size={props.size ?? 'small'}
      pagination={buildPagination(props)}
    />
  );
}
