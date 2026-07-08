import React from 'react';
import { Result } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';

const AdLogs: React.FC = () => {
  return (
    <Result
      icon={<FileTextOutlined style={{ color: '#2563eb' }} />}
      title="执行日志"
      subTitle="广告操作与投放变更记录追踪 — 开发中"
    />
  );
};

export default AdLogs;
