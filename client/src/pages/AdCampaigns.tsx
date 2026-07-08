import React from 'react';
import { Result } from 'antd';
import { AppstoreOutlined } from '@ant-design/icons';

const AdCampaigns: React.FC = () => {
  return (
    <Result
      icon={<AppstoreOutlined style={{ color: '#2563eb' }} />}
      title="系列管理"
      subTitle="广告系列创建、投放管理与预算控制 — 开发中"
    />
  );
};

export default AdCampaigns;
