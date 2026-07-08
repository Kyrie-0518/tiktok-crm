import React from 'react';
import { Result } from 'antd';
import { PictureOutlined } from '@ant-design/icons';

const AdCreatives: React.FC = () => {
  return (
    <Result
      icon={<PictureOutlined style={{ color: '#2563eb' }} />}
      title="素材分析"
      subTitle="广告素材效果分析与创意洞察 — 开发中"
    />
  );
};

export default AdCreatives;
