import React from 'react';
import { Result } from 'antd';
import { SafetyOutlined } from '@ant-design/icons';

const AdAccounts: React.FC = () => {
  return (
    <Result
      icon={<SafetyOutlined style={{ color: '#2563eb' }} />}
      title="账户授权"
      subTitle="TikTok Ads 账户管理与授权绑定 — 开发中"
    />
  );
};

export default AdAccounts;
