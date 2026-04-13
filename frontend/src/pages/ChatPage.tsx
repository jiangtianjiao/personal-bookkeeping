import React, { useState, useRef, useEffect } from 'react';
import { Input, Button, Typography, Space, Spin, Empty, Grid, Tag, Tooltip } from 'antd';
import {
  SendOutlined,
  RobotOutlined,
  UserOutlined,
  BulbOutlined,
  ClearOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '../store/authStore';
import { apiService } from '../services/api';
import dayjs from 'dayjs';

const { TextArea } = Input;
const { Text, Title } = Typography;
const { useBreakpoint } = Grid;

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

const quickActions = [
  { label: '查看我的账户', message: '帮我查看所有账户和余额' },
  { label: '本月收支', message: '这个月的收入和支出是多少？' },
  { label: '财务概览', message: '给我看一下财务总览' },
  { label: '记一笔支出', message: '帮我记一笔支出，' },
  { label: '记一笔收入', message: '帮我记一笔收入，' },
  { label: '最近交易', message: '查看最近的交易记录' },
];

const ChatPage: React.FC = () => {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadHistory = async () => {
    try {
      const data = await apiService.get<{ conversationId: string; messages: ChatMsg[] }>('/ai/history');
      if (data.messages && data.messages.length > 0) {
        setConversationId(data.conversationId);
        setMessages(
          data.messages.map((m: any) => ({
            role: m.role,
            content: m.content,
            timestamp: m.timestamp,
          }))
        );
      }
    } catch {}
  };

  const sendMessage = async (text?: string) => {
    const msg = text || inputValue.trim();
    if (!msg || loading) return;

    const userMsg: ChatMsg = {
      role: 'user',
      content: msg,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setLoading(true);

    try {
      const data = await apiService.post<{ conversationId: string; message: string; timestamp: string }>(
        '/ai/chat',
        { message: msg, conversationId }
      );

      if (data.conversationId) setConversationId(data.conversationId);

      const assistantMsg: ChatMsg = {
        role: 'assistant',
        content: data.message,
        timestamp: data.timestamp,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (error: any) {
      const errorData = error.response?.data?.error;
      const assistantMsg: ChatMsg = {
        role: 'assistant',
        content: `⚠️ ${errorData?.message || '服务暂时不可用'}${errorData?.details ? `\n\n详细信息：${errorData.details}` : ''}`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = async () => {
    try {
      await apiService.delete('/ai/history', {
        data: { conversationId },
      } as any);
      setMessages([]);
      setConversationId('');
    } catch {}
  };

  const renderMessageContent = (content: string) => {
    const lines = content.split('\n');
    return lines.map((line, i) => {
      if (line.startsWith('```')) return null;
      if (line.startsWith('- ')) {
        return (
          <div key={i} style={{ paddingLeft: 8 }}>
            • {line.slice(2)}
          </div>
        );
      }
      if (line.match(/^\d+\./)) {
        return (
          <div key={i} style={{ paddingLeft: 8 }}>
            {line}
          </div>
        );
      }
      return <div key={i}>{line || <br />}</div>;
    });
  };

  return (
    <div style={{ height: isMobile ? 'calc(100vh - 120px)' : 'calc(100vh - 136px)', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
          flexShrink: 0,
        }}
      >
        <Space>
          <RobotOutlined style={{ fontSize: 20, color: '#4f46e5' }} />
          <Title level={4} style={{ margin: 0 }}>
            AI 记账助手
          </Title>
        </Space>
        <Tooltip title="清空对话">
          <Button
            icon={<ClearOutlined />}
            size="small"
            onClick={clearHistory}
            disabled={messages.length === 0}
          >
            {!isMobile && '清空对话'}
          </Button>
        </Tooltip>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px 4px',
          background: isMobile ? 'transparent' : '#fafafa',
          borderRadius: 8,
          border: isMobile ? 'none' : '1px solid #f0f0f0',
        }}
      >
        {messages.length === 0 && !loading && (
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <Empty
              image={<RobotOutlined style={{ fontSize: 48, color: '#bfbfbf' }} />}
              description={
                <Space direction="vertical" size={4}>
                  <Text type="secondary">你好！我是你的 AI 记账助手</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    我可以帮你记账、查询账户、查看报表
                  </Text>
                </Space>
              }
            />
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'center',
                gap: 8,
                marginTop: 20,
              }}
            >
              {quickActions.map((action) => (
                <Tag
                  key={action.label}
                  color="blue"
                  style={{ cursor: 'pointer', margin: 0, padding: '4px 12px' }}
                  onClick={() => sendMessage(action.message)}
                >
                  <BulbOutlined /> {action.label}
                </Tag>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              marginBottom: 12,
              padding: '0 8px',
            }}
          >
            <div
              style={{
                display: 'flex',
                gap: 8,
                maxWidth: isMobile ? '90%' : '75%',
                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                alignItems: 'flex-start',
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  background: msg.role === 'user' ? '#4f46e5' : '#52c41a',
                  color: '#fff',
                  fontSize: 14,
                }}
              >
                {msg.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
              </div>
              <div
                style={{
                  background: msg.role === 'user' ? '#4f46e5' : '#fff',
                  color: msg.role === 'user' ? '#fff' : '#333',
                  padding: '10px 14px',
                  borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                  fontSize: 14,
                  lineHeight: 1.6,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                  border: msg.role === 'assistant' ? '1px solid #f0f0f0' : 'none',
                }}
              >
                {renderMessageContent(msg.content)}
                <div
                  style={{
                    fontSize: 10,
                    opacity: 0.6,
                    marginTop: 4,
                    textAlign: msg.role === 'user' ? 'right' : 'left',
                  }}
                >
                  {dayjs(msg.timestamp).format('HH:mm')}
                </div>
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', gap: 8, padding: '0 8px', marginBottom: 12 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#52c41a',
                color: '#fff',
                fontSize: 14,
              }}
            >
              <RobotOutlined />
            </div>
            <div
              style={{
                background: '#fff',
                padding: '12px 16px',
                borderRadius: '12px 12px 12px 2px',
                border: '1px solid #f0f0f0',
              }}
            >
              <Spin size="small" />
              <Text type="secondary" style={{ marginLeft: 8 }}>
                思考中...
              </Text>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div
        style={{
          display: 'flex',
          gap: 8,
          marginTop: 12,
          flexShrink: 0,
        }}
      >
        <TextArea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onPressEnter={(e) => {
            if (!e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder="输入消息，如：帮我记一笔午餐支出30元..."
          autoSize={{ minRows: 1, maxRows: 3 }}
          disabled={loading}
          style={{
            borderRadius: 8,
            resize: 'none',
          }}
        />
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={() => sendMessage()}
          loading={loading}
          disabled={!inputValue.trim()}
          style={{
            height: 'auto',
            borderRadius: 8,
            minWidth: 48,
          }}
        />
      </div>
    </div>
  );
};

export default ChatPage;
