import React from 'react';
import { Result } from 'antd';
import { ControlOutlined } from '@ant-design/icons';

const AdRules: React.FC = () => {
  return (
    <Result
      icon={<ControlOutlined style={{ color: '#2563eb' }} />}
      title="智能规则"
      subTitle="自动化广告优化规则配置（出价/预算/暂停策略）— 开发中"
    />
  );
};

export default AdRules;
