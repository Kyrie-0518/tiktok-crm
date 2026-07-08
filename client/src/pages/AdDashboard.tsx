import React from 'react';
import { Result } from 'antd';
import { FundOutlined } from '@ant-design/icons';

const AdDashboard: React.FC = () => {
  return (
    <Result
      icon={<FundOutlined style={{ color: '#2563eb' }} />}
      title="广告仪表盘"
      subTitle="TK GMV Max 广告数据全景视图 — 可视化仪表盘开发中"
    />
  );
};

export default AdDashboard;
