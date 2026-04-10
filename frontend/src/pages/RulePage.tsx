import React, { useEffect, useState } from 'react';
import {
  Card,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Space,
  Switch,
  Tag,
  Popconfirm,
  message,
  Empty,
  Row,
  Col,
  Divider,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  MinusCircleOutlined,
} from '@ant-design/icons';
import { apiService } from '../services/api';
import type {
  Rule,
  RuleCreateRequest,
  Tag as TagType,
  Category,
} from '../types';
import { useIsMobile } from '../hooks/useIsMobile';

const triggerTypeLabels: Record<string, string> = {
  description_contains: '描述包含',
  amount_greater: '金额大于',
  amount_less: '金额小于',
};

const actionTypeLabels: Record<string, string> = {
  set_category: '设置分类',
  add_tag: '添加标签',
  set_description: '设置描述',
};

const triggerTypeOptions = Object.entries(triggerTypeLabels).map(([value, label]) => ({
  value,
  label,
}));

const actionTypeOptions = Object.entries(actionTypeLabels).map(([value, label]) => ({
  value,
  label,
}));

interface ActionRowProps {
  name: number;
  restField: { fieldKey?: number };
  isMobile: boolean;
  form: ReturnType<typeof Form.useForm>[0];
  categories: Category[];
  tags: TagType[];
  canRemove: boolean;
  onRemove: () => void;
}

const ActionRow: React.FC<ActionRowProps> = ({ name, restField, isMobile, form, categories, tags, canRemove, onRemove }) => {
  const actionType = Form.useWatch(['actions', name, 'actionType'], form);

  const renderValueField = () => {
    if (actionType === 'set_category') {
      return (
        <Select placeholder="选择分类" allowClear>
          {categories.map((cat) => (
            <Select.Option key={cat.id} value={cat.id}>
              {cat.icon ? `${cat.icon} ` : ''}{cat.name}
            </Select.Option>
          ))}
        </Select>
      );
    }
    if (actionType === 'add_tag') {
      return (
        <Select placeholder="选择标签" allowClear>
          {tags.map((tag) => (
            <Select.Option key={tag.id} value={tag.id}>
              <Tag color={tag.color || undefined} style={{ margin: 0 }}>{tag.name}</Tag>
            </Select.Option>
          ))}
        </Select>
      );
    }
    return <Input placeholder="输入值" />;
  };

  return (
    <Space
      style={{ display: 'flex', marginBottom: 8, width: '100%' }}
      align="baseline"
      wrap={isMobile}
    >
      <Form.Item
        {...restField}
        name={[name, 'actionType']}
        rules={[{ required: true, message: '请选择类型' }]}
        style={{ marginBottom: 0, minWidth: 140 }}
      >
        <Select
          placeholder="动作类型"
          options={actionTypeOptions}
          style={{ width: isMobile ? 130 : 160 }}
          onChange={() => {
            form.setFieldValue(['actions', name, 'actionValue'], undefined);
          }}
        />
      </Form.Item>
      <Form.Item
        {...restField}
        name={[name, 'actionValue']}
        rules={[{ required: true, message: '请输入值' }]}
        style={{ marginBottom: 0, flex: 1 }}
      >
        {renderValueField()}
      </Form.Item>
      {canRemove && (
        <MinusCircleOutlined
          onClick={onRemove}
          style={{ color: '#ef4444', fontSize: 16 }}
        />
      )}
    </Space>
  );
};

const RulePage: React.FC = () => {
  const isMobile = useIsMobile();

  const [rules, setRules] = useState<Rule[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<TagType[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [form] = Form.useForm();

  const fetchRules = async () => {
    setLoading(true);
    try {
      const data = await apiService.get<Rule[]>('/rules');
      setRules(data);
    } catch {
      message.error('获取规则列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const data = await apiService.get<Category[]>('/categories');
      setCategories(data);
    } catch {
      /* ignore */
    }
  };

  const fetchTags = async () => {
    try {
      const data = await apiService.get<TagType[]>('/tags');
      setTags(data);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    fetchRules();
    fetchCategories();
    fetchTags();
  }, []);

  const handleAdd = () => {
    setEditingRule(null);
    form.resetFields();
    form.setFieldsValue({
      strictMode: true,
      triggers: [{ triggerType: undefined, triggerValue: '' }],
      actions: [{ actionType: undefined, actionValue: '' }],
    });
    setModalVisible(true);
  };

  const handleEdit = (rule: Rule) => {
    setEditingRule(rule);
    form.setFieldsValue({
      title: rule.title,
      strictMode: rule.strictMode,
      triggers: rule.triggers.map((t) => ({
        triggerType: t.triggerType,
        triggerValue: t.triggerValue,
      })),
      actions: rule.actions.map((a) => ({
        actionType: a.actionType,
        actionValue: a.actionValue,
      })),
    });
    setModalVisible(true);
  };

  const handleSubmit = async (values: any) => {
    const payload: RuleCreateRequest = {
      title: values.title,
      strictMode: values.strictMode ?? true,
      triggers: (values.triggers || []).map((t: any, i: number) => ({
        triggerType: t.triggerType,
        triggerValue: t.triggerValue,
        order: i,
      })),
      actions: (values.actions || []).map((a: any, i: number) => ({
        actionType: a.actionType,
        actionValue: a.actionValue,
        order: i,
      })),
    };
    try {
      if (editingRule) {
        await apiService.put(`/rules/${editingRule.id}`, payload);
        message.success('规则更新成功');
      } else {
        await apiService.post('/rules', payload);
        message.success('规则创建成功');
      }
      setModalVisible(false);
      form.resetFields();
      setEditingRule(null);
      fetchRules();
    } catch (error: any) {
      message.error(error?.response?.data?.message || '操作失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiService.delete(`/rules/${id}`);
      message.success('规则已删除');
      fetchRules();
    } catch (error: any) {
      message.error(error?.response?.data?.message || '删除失败');
    }
  };

  const formatTriggerSummary = (rule: Rule): string => {
    if (rule.triggers.length === 0) return '无条件';
    return rule.triggers
      .map((t) => `${triggerTypeLabels[t.triggerType] || t.triggerType} "${t.triggerValue}"`)
      .join(rule.strictMode ? ' 且 ' : ' 或 ');
  };

  const formatActionSummary = (rule: Rule): string => {
    if (rule.actions.length === 0) return '无动作';
    return rule.actions
      .map((a) => {
        const label = actionTypeLabels[a.actionType] || a.actionType;
        if (a.actionType === 'set_category') {
          const cat = categories.find((c) => c.id === a.actionValue);
          return `${label}: ${cat?.name || a.actionValue}`;
        }
        if (a.actionType === 'add_tag') {
          const tag = tags.find((t) => t.id === a.actionValue);
          return `${label}: ${tag?.name || a.actionValue}`;
        }
        return `${label}: "${a.actionValue}"`;
      })
      .join('；');
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 className="page-title" style={{ margin: 0 }}>规则管理</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} size={isMobile ? 'small' : 'middle'}>
          新建规则
        </Button>
      </div>

      {loading ? (
        <Card loading />
      ) : rules.length > 0 ? (
        <Row gutter={[12, 12]}>
          {rules.map((rule) => (
            <Col xs={24} md={12} lg={8} key={rule.id}>
              <Card
                size="small"
                hoverable
                styles={{ body: { padding: 16 } }}
                style={{ height: '100%' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 15, flex: 1, marginRight: 8 }}>{rule.title}</span>
                  <Tag color={rule.isActive ? '#10b981' : '#94a3b8'} style={{ fontSize: 11, flexShrink: 0 }}>
                    {rule.isActive ? '启用' : '停用'}
                  </Tag>
                </div>

                <div style={{ marginBottom: 8 }}>
                  <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 2 }}>
                    匹配模式：{rule.strictMode ? '全部满足 (AND)' : '任一满足 (OR)'}
                  </div>
                  <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 2 }}>
                    条件：{formatTriggerSummary(rule)}
                  </div>
                  <div style={{ color: '#6b7280', fontSize: 12 }}>
                    动作：{formatActionSummary(rule)}
                  </div>
                </div>

                <Divider style={{ margin: '8px 0' }} />

                <Space size={4}>
                  <Button
                    type="text"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => handleEdit(rule)}
                    style={{ color: '#4f46e5' }}
                  >
                    编辑
                  </Button>
                  <Popconfirm
                    title="确认删除"
                    description={`确定要删除规则「${rule.title}」吗？`}
                    onConfirm={() => handleDelete(rule.id)}
                    okText="删除"
                    cancelText="取消"
                    okButtonProps={{ danger: true }}
                  >
                    <Button
                      type="text"
                      size="small"
                      icon={<DeleteOutlined />}
                      style={{ color: '#ef4444' }}
                    >
                      删除
                    </Button>
                  </Popconfirm>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      ) : (
        <Card>
          <Empty
            description="暂无规则，点击右上角创建"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </Card>
      )}

      <Modal
        title={editingRule ? '编辑规则' : '新建规则'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
          setEditingRule(null);
        }}
        footer={null}
        width={isMobile ? '95%' : 640}
        styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            strictMode: true,
            triggers: [{ triggerType: undefined, triggerValue: '' }],
            actions: [{ actionType: undefined, actionValue: '' }],
          }}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="title"
            label="规则标题"
            rules={[{ required: true, message: '请输入规则标题' }]}
          >
            <Input placeholder="例如：自动分类外卖消费" />
          </Form.Item>

          <Form.Item
            name="strictMode"
            label="匹配模式"
            valuePropName="checked"
          >
            <Switch
              checkedChildren="全部满足 (AND)"
              unCheckedChildren="任一满足 (OR)"
            />
          </Form.Item>

          <Divider orientation="left" style={{ fontSize: 13, color: '#6b7280' }}>
            触发条件
          </Divider>

          <Form.List name="triggers">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Space
                    key={key}
                    style={{ display: 'flex', marginBottom: 8, width: '100%' }}
                    align="baseline"
                    wrap={isMobile}
                  >
                    <Form.Item
                      {...restField}
                      name={[name, 'triggerType']}
                      rules={[{ required: true, message: '请选择类型' }]}
                      style={{ marginBottom: 0, minWidth: 140 }}
                    >
                      <Select
                        placeholder="条件类型"
                        options={triggerTypeOptions}
                        style={{ width: isMobile ? 130 : 160 }}
                      />
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      name={[name, 'triggerValue']}
                      rules={[{ required: true, message: '请输入值' }]}
                      style={{ marginBottom: 0, flex: 1 }}
                    >
                      <Input placeholder="匹配值" style={{ width: isMobile ? 130 : 200 }} />
                    </Form.Item>
                    {fields.length > 1 && (
                      <MinusCircleOutlined
                        onClick={() => remove(name)}
                        style={{ color: '#ef4444', fontSize: 16 }}
                      />
                    )}
                  </Space>
                ))}
                <Button
                  type="dashed"
                  onClick={() => add({ triggerType: undefined, triggerValue: '' })}
                  icon={<PlusOutlined />}
                  style={{ width: '100%', marginBottom: 16 }}
                >
                  添加条件
                </Button>
              </>
            )}
          </Form.List>

          <Divider orientation="left" style={{ fontSize: 13, color: '#6b7280' }}>
            执行动作
          </Divider>

          <Form.List name="actions">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <ActionRow
                    key={key}
                    name={name}
                    restField={restField}
                    isMobile={isMobile}
                    form={form}
                    categories={categories}
                    tags={tags}
                    canRemove={fields.length > 1}
                    onRemove={() => remove(name)}
                  />
                ))}
                <Button
                  type="dashed"
                  onClick={() => add({ actionType: undefined, actionValue: '' })}
                  icon={<PlusOutlined />}
                  style={{ width: '100%', marginBottom: 16 }}
                >
                  添加动作
                </Button>
              </>
            )}
          </Form.List>

          <Form.Item style={{ marginBottom: 0 }}>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingRule ? '保存' : '创建'}
              </Button>
              <Button onClick={() => {
                setModalVisible(false);
                form.resetFields();
                setEditingRule(null);
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

export default RulePage;
