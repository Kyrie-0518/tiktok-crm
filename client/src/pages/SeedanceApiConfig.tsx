import React, { useEffect, useState } from 'react';
import { Table, Button, Space, Modal, Form, Input, Select, Tag, message, Popconfirm, Tooltip } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, PlayCircleOutlined, StopOutlined } from '@ant-design/icons';
import api from '../api';

interface SeedanceApi {
  id: number;
  name: string;
  api_url: string;
  app_id: string;
  app_secret: string;
  status: 'enabled' | 'disabled';
  created_at: string;
  updated_at: string;
}

export default function SeedanceApiConfig() {
  const [data, setData] = useState<SeedanceApi[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form] = Form.useForm();
  const [secretVisible, setSecretVisible] = useState<Record<number, boolean>>({});

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/seedance/apis');
      setData(res.data);
    } catch (e: any) {
      message.error('获取API配置失败: ' + (e.response?.data?.error || e.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAdd = () => {
    setEditingId(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = (record: SeedanceApi) => {
    setEditingId(record.id);
    form.setFieldsValue({
      name: record.name,
      api_url: record.api_url,
      app_id: record.app_id,
      app_secret: '', // 不显示原密码
      status: record.status,
    });
    setModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/seedance/apis/${id}`);
      message.success('删除成功');
      fetchData();
    } catch (e: any) {
      message.error('删除失败: ' + (e.response?.data?.error || e.message));
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (!values.app_secret) {
        message.warning('请输入AppSecret');
        return;
      }
      if (editingId) {
        await api.put(`/seedance/apis/${editingId}`, values);
        message.success('更新成功');
      } else {
        await api.post('/seedance/apis', values);
        message.success('创建成功');
      }
      setModalOpen(false);
      fetchData();
    } catch (e: any) {
      if (e.response?.data?.error) {
        message.error(e.response.data.error);
      }
    }
  };

  const handleBatchStatus = async (status: 'enabled' | 'disabled') => {
    const selected = data.filter(d => d.status !== status);
    if (selected.length === 0) {
      message.info(`没有需要${status === 'enabled' ? '启用' : '禁用'}的项`);
      return;
    }
    try {
      await api.post('/seedance/apis/batch-status', {
        ids: selected.map(d => d.id),
        status,
      });
      message.success(`已${status === 'enabled' ? '启用' : '禁用'} ${selected.length} 个配置`);
      fetchData();
    } catch (e: any) {
      message.error('操作失败: ' + (e.response?.data?.error || e.message));
    }
  };

  const columns = [
    {
      title: '配置名称',
      dataIndex: 'name',
      key: 'name',
      width: 150,
    },
    {
      title: 'API 环境地址',
      dataIndex: 'api_url',
      key: 'api_url',
      width: 200,
      ellipsis: true,
    },
    {
      title: 'AppID',
      dataIndex: 'app_id',
      key: 'app_id',
      width: 180,
    },
    {
      title: 'AppSecret',
      dataIndex: 'app_secret',
      key: 'app_secret',
      width: 120,
      render: (text: string, record: SeedanceApi) => (
        <span>
          {secretVisible[record.id] ? record.app_secret || '••••••••' : '••••••••'}
          <Tooltip title={secretVisible[record.id] ? '点击隐藏' : '点击显示'}>
            <a
              style={{ marginLeft: 8 }}
              onClick={() => setSecretVisible(prev => ({ ...prev, [record.id]: !prev[record.id] }))}
            >
              {secretVisible[record.id] ? '👁' : '👁‍🗨'}
            </a>
          </Tooltip>
        </span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={status === 'enabled' ? 'green' : 'default'}>
          {status === 'enabled' ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (text: string) => text ? new Date(text).toLocaleString('zh-CN') : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: any, record: SeedanceApi) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确认删除？"
            description="删除后无法恢复"
            onConfirm={() => handleDelete(record.id)}
            okText="确认"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Seedance API 配置管理</h2>
        <Space>
          <Button icon={<PlayCircleOutlined />} onClick={() => handleBatchStatus('enabled')}>
            批量启用
          </Button>
          <Button icon={<StopOutlined />} onClick={() => handleBatchStatus('disabled')}>
            批量禁用
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            新增配置
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
        bordered
      />

      <Modal
        title={editingId ? '编辑 API 配置' : '新增 API 配置'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        okText="保存"
        cancelText="取消"
        width={500}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label="配置名称"
            rules={[{ required: true, message: '请输入配置名称' }]}
          >
            <Input placeholder="如：主业务API、备用API" />
          </Form.Item>
          <Form.Item
            name="api_url"
            label="API 环境地址"
            rules={[{ required: true, message: '请输入API地址' }]}
          >
            <Input placeholder="https://api.example.com" />
          </Form.Item>
          <Form.Item
            name="app_id"
            label="AppID"
            rules={[{ required: true, message: '请输入AppID' }]}
          >
            <Input placeholder="请输入AppID" />
          </Form.Item>
          <Form.Item
            name="app_secret"
            label="AppSecret"
            rules={[{ required: !editingId, message: editingId ? '留空则保持原密码' : '请输入AppSecret' }]}
            extra={editingId ? '留空则保持原密码不变' : ''}
          >
            <Input.Password placeholder={editingId ? '留空保持原密码' : '请输入AppSecret'} />
          </Form.Item>
          <Form.Item name="status" label="状态" initialValue="disabled">
            <Select>
              <Select.Option value="enabled">启用</Select.Option>
              <Select.Option value="disabled">禁用</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
