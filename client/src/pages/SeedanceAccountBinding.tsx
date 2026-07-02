import React, { useEffect, useState } from 'react';
import { Table, Button, Space, Modal, Select, Tag, message } from 'antd';
import { ApiOutlined } from '@ant-design/icons';
import api from '../api';

interface AccountBinding {
  user_id: number;
  username: string;
  display_name: string;
  role_name: string;
  role_key: string;
  api_id: number | null;
  api_name: string | null;
  api_status: string | null;
}

interface EnabledApi {
  id: number;
  name: string;
  status: string;
}

export default function SeedanceAccountBinding() {
  const [data, setData] = useState<AccountBinding[]>([]);
  const [apis, setApis] = useState<EnabledApi[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AccountBinding | null>(null);
  const [selectedApiId, setSelectedApiId] = useState<number | null>(null);
  const [assigning, setAssigning] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [bindingsRes, apisRes] = await Promise.all([
        api.get('/seedance/account-bindings'),
        api.get('/seedance/enabled-apis'),
      ]);
      setData(bindingsRes.data);
      setApis(apisRes.data);
    } catch (e: any) {
      message.error('获取数据失败: ' + (e.response?.data?.error || e.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAssign = (record: AccountBinding) => {
    setSelectedUser(record);
    setSelectedApiId(record.api_id);
    setModalOpen(true);
  };

  const handleConfirm = async () => {
    if (!selectedUser) return;
    setAssigning(true);
    try {
      await api.post('/seedance/account-bindings', {
        user_id: selectedUser.user_id,
        api_id: selectedApiId,
      });
      message.success(selectedApiId ? 'API绑定成功' : '已解除API绑定');
      setModalOpen(false);
      fetchData();
    } catch (e: any) {
      message.error('绑定失败: ' + (e.response?.data?.error || e.message));
    } finally {
      setAssigning(false);
    }
  };

  const getBindingStatus = (record: AccountBinding) => {
    if (!record.api_id) {
      return <Tag color="default">未分配</Tag>;
    }
    if (record.api_status === 'enabled') {
      return <Tag color="green">{record.api_name}</Tag>;
    }
    return <Tag color="red">{record.api_name} (已禁用)</Tag>;
  };

  const columns = [
    {
      title: '账号名称',
      dataIndex: 'username',
      key: 'username',
      width: 150,
    },
    {
      title: '显示名称',
      dataIndex: 'display_name',
      key: 'display_name',
      width: 150,
      render: (text: string) => text || '-',
    },
    {
      title: '账号角色',
      dataIndex: 'role_name',
      key: 'role_name',
      width: 120,
      render: (text: string, record: AccountBinding) => (
        <Tag color={record.role_key === 'developer' ? 'purple' : record.role_key === 'manager' ? 'blue' : 'default'}>
          {text}
        </Tag>
      ),
    },
    {
      title: '绑定 API 配置',
      key: 'api_binding',
      width: 200,
      render: (_: any, record: AccountBinding) => getBindingStatus(record),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: any, record: AccountBinding) => (
        <Button
          type="link"
          icon={<ApiOutlined />}
          onClick={() => handleAssign(record)}
        >
          {record.api_id ? '重新分配' : '分配 API'}
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>账号绑定 Seedance API 分配</h2>
        <Space>
          <span style={{ color: '#999', fontSize: 13 }}>
            共 {data.length} 个账号 | 已绑定 {data.filter(d => d.api_id).length} 个
          </span>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={data}
        rowKey="user_id"
        loading={loading}
        pagination={false}
        bordered
      />

      <Modal
        title={`为「${selectedUser?.username}」分配 API`}
        open={modalOpen}
        onOk={handleConfirm}
        onCancel={() => setModalOpen(false)}
        okText="确认分配"
        cancelText="取消"
        confirmLoading={assigning}
      >
        <div style={{ padding: '16px 0' }}>
          <div style={{ marginBottom: 8, color: '#666' }}>账号信息</div>
          <div style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
            <div>用户名：{selectedUser?.username}</div>
            <div>显示名：{selectedUser?.display_name || '-'}</div>
            <div>角色：{selectedUser?.role_name}</div>
          </div>

          <div style={{ marginBottom: 8, color: '#666' }}>选择 API 配置</div>
          <Select
            style={{ width: '100%' }}
            placeholder="请选择API配置"
            value={selectedApiId}
            onChange={setSelectedApiId}
            allowClear
            options={[
              { label: '不分配（禁用该账号权限）', value: null },
              ...apis.map(a => ({ label: a.name, value: a.id })),
            ]}
          />
          <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
            {apis.length === 0 && '当前没有启用的API配置，请先在「API配置管理」中添加并启用'}
          </div>
        </div>
      </Modal>
    </div>
  );
}
