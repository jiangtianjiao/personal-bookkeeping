import React, { useEffect, useState } from 'react';
import {
  Card,
  Button,
  Modal,
  Form,
  Input,
  Tag,
  Space,
  Popconfirm,
  message,
  Empty,
  ColorPicker,
  Row,
  Col,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { apiService } from '../services/api';
import type { Tag as TagType, TagCreateRequest } from '../types';
import { useIsMobile } from '../hooks/useIsMobile';

const PRESET_COLORS = [
  '#4f46e5', '#7c3aed', '#db2777', '#ef4444', '#f59e0b',
  '#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6',
  '#ec4899', '#f97316', '#84cc16', '#14b8a6', '#0ea5e9',
];

const TagPage: React.FC = () => {
  const isMobile = useIsMobile();

  const [tags, setTags] = useState<TagType[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTag, setEditingTag] = useState<TagType | null>(null);
  const [form] = Form.useForm();

  const fetchTags = async () => {
    setLoading(true);
    try {
      const data = await apiService.get<TagType[]>('/tags');
      setTags(data);
    } catch {
      message.error('获取标签列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTags();
  }, []);

  const handleAdd = () => {
    setEditingTag(null);
    form.resetFields();
    form.setFieldsValue({ color: '#4f46e5' });
    setModalVisible(true);
  };

  const handleEdit = (tag: TagType) => {
    setEditingTag(tag);
    form.setFieldsValue({
      name: tag.name,
      color: tag.color || '#4f46e5',
    });
    setModalVisible(true);
  };

  const handleSubmit = async (values: any) => {
    const color = typeof values.color === 'string' ? values.color : values.color?.toHexString?.() || '#4f46e5';
    const payload: TagCreateRequest = {
      name: values.name,
      color,
    };
    try {
      if (editingTag) {
        await apiService.put(`/tags/${editingTag.id}`, payload);
        message.success('标签更新成功');
      } else {
        await apiService.post('/tags', payload);
        message.success('标签创建成功');
      }
      setModalVisible(false);
      form.resetFields();
      setEditingTag(null);
      fetchTags();
    } catch (error: any) {
      message.error(error?.response?.data?.message || '操作失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiService.delete(`/tags/${id}`);
      message.success('标签已删除');
      fetchTags();
    } catch (error: any) {
      message.error(error?.response?.data?.message || '删除失败');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 className="page-title" style={{ margin: 0 }}>标签管理</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} size={isMobile ? 'small' : 'middle'}>
          新建标签
        </Button>
      </div>

      <Card loading={loading}>
        {tags.length > 0 ? (
          <Row gutter={[12, 12]}>
            {tags.map((tag) => (
              <Col key={tag.id}>
                <Card
                  size="small"
                  hoverable
                  style={{ borderColor: tag.color || '#d9d9d9' }}
                  styles={{ body: { padding: '12px 16px' } }}
                >
                  <Space size={8} align="center">
                    <Tag
                      color={tag.color || undefined}
                      style={{ margin: 0, fontSize: 14, padding: '2px 10px' }}
                    >
                      {tag.name}
                    </Tag>
                    <Button
                      type="text"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => handleEdit(tag)}
                      style={{ color: '#6b7280' }}
                    />
                    <Popconfirm
                      title="确认删除"
                      description={`确定要删除标签「${tag.name}」吗？`}
                      onConfirm={() => handleDelete(tag.id)}
                      okText="删除"
                      cancelText="取消"
                      okButtonProps={{ danger: true }}
                    >
                      <Button
                        type="text"
                        size="small"
                        icon={<DeleteOutlined />}
                        style={{ color: '#ef4444' }}
                      />
                    </Popconfirm>
                  </Space>
                </Card>
              </Col>
            ))}
          </Row>
        ) : (
          <Empty
            description="暂无标签，点击右上角创建"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        )}
      </Card>

      <Modal
        title={editingTag ? '编辑标签' : '新建标签'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
          setEditingTag(null);
        }}
        footer={null}
        width={isMobile ? '90%' : 420}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{ color: '#4f46e5' }}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="name"
            label="标签名称"
            rules={[{ required: true, message: '请输入标签名称' }]}
          >
            <Input placeholder="例如：餐饮、交通、日常" />
          </Form.Item>

          <Form.Item
            name="color"
            label="标签颜色"
          >
            <ColorPicker
              presets={[{ label: '推荐颜色', colors: PRESET_COLORS }]}
              showText
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingTag ? '保存' : '创建'}
              </Button>
              <Button onClick={() => {
                setModalVisible(false);
                form.resetFields();
                setEditingTag(null);
              }}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default TagPage;
