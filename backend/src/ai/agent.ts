import { StateGraph, Annotation, messagesStateReducer, END } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { SystemMessage, HumanMessage, AIMessage, BaseMessage, ToolMessage } from '@langchain/core/messages';
import { allTools, setToolContext, clearToolContext } from './tools';
import { searchKnowledge } from './knowledge';
import prisma from '../config/database';

const GraphState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({ reducer: messagesStateReducer, default: () => [] }),
  userId: Annotation<string>(),
  conversationId: Annotation<string>(),
});

const toolMap = new Map(allTools.map(t => [t.name, t]));

async function executeToolCalls(lastMessage: any, userId: string): Promise<ToolMessage[]> {
  const results: ToolMessage[] = [];
  const toolCalls: { id: string; name: string; args: any }[] = lastMessage.tool_calls || [];

  for (const tc of toolCalls) {
    const tool = toolMap.get(tc.name);
    if (!tool) {
      results.push(new ToolMessage({ content: `Tool ${tc.name} not found`, tool_call_id: tc.id }));
      continue;
    }
    try {
      const result = await tool.invoke(tc.args, { tags: [userId] } as any);
      results.push(new ToolMessage({ content: result, tool_call_id: tc.id }));
    } catch (err: any) {
      results.push(new ToolMessage({ content: JSON.stringify({ error: err.message }), tool_call_id: tc.id }));
    }
  }
  return results;
}

export async function createAgentGraph() {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseURL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const modelName = process.env.AI_MODEL || 'gpt-4o-mini';

  if (!apiKey) {
    throw new Error('请在.env中配置OPENAI_API_KEY');
  }

  const llm = new ChatOpenAI({
    modelName,
    temperature: 0.1,
    openAIApiKey: apiKey,
    configuration: { baseURL },
  });

  const llmWithTools = llm.bindTools(allTools);

  const systemPrompt = `你是一个专业的个人记账助手，帮助用户进行复式记账、查询财务数据和解答会计问题。

你的核心能力：
1. **快速记账**：用户描述一笔收支，你调用quick_entry工具完成记账
2. **查询账户**：调用list_accounts查看用户的账户和余额
3. **查询交易**：调用query_transactions按日期/账户/类型查询交易记录
4. **创建账户**：调用create_account帮助用户新建账户
5. **财务概览**：调用get_report获取财务报表和仪表板数据

记账规则参考：
${searchKnowledge('复式记账规则')}

交互原则：
- 用中文回复，简洁友好
- 记账时主动确认关键信息（金额、账户、分类）
- 如果用户说的账户不存在，先询问是否要创建，或直接用quick_entry自动创建
- 对于模糊的记账请求，先用list_accounts查看可用账户
- 金额一定要确认准确，不能猜测
- 如果信息不足，礼貌询问补充信息`;

  async function agentNode(state: typeof GraphState.State) {
    const { messages, userId } = state;

    let contextInfo = '';
    const lastUserMsg = messages.filter(m => m instanceof HumanMessage).pop();
    if (lastUserMsg) {
      const content = typeof lastUserMsg.content === 'string' ? lastUserMsg.content : '';
      if (content.includes('账户') || content.includes('余额') || content.includes('资产') || content.includes('负债')) {
        const accounts = await prisma.account.findMany({
          where: { userId, isActive: true },
          orderBy: [{ accountType: 'asc' }, { name: 'asc' }],
          select: { name: true, accountType: true },
        });
        contextInfo += `\n当前用户账户：${accounts.map(a => `${a.name}(${a.accountType})`).join('、')}`;
      }
    }

    const systemMsg = new SystemMessage(systemPrompt + contextInfo);
    const allMsgs = [systemMsg, ...messages];
    const response = await llmWithTools.invoke(allMsgs);
    return { messages: [response] };
  }

  async function toolsNode(state: typeof GraphState.State) {
    const { messages, userId } = state;
    const lastMsg = messages[messages.length - 1] as any;
    const toolResults = await executeToolCalls(lastMsg, userId);
    return { messages: toolResults };
  }

  function shouldContinue(state: typeof GraphState.State) {
    const msgs = state.messages;
    const last = msgs[msgs.length - 1] as any;
    if (
      last &&
      typeof last === 'object' &&
      'tool_calls' in last &&
      Array.isArray(last.tool_calls) &&
      last.tool_calls.length > 0
    ) {
      return 'tools';
    }
    return END;
  }

  const workflow = new StateGraph(GraphState)
    .addNode('agent', agentNode)
    .addNode('tools', toolsNode)
    .addEdge('__start__', 'agent')
    .addConditionalEdges('agent', shouldContinue)
    .addEdge('tools', 'agent');

  return workflow.compile();
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: any[];
  timestamp: Date;
}

export async function chat(userId: string, userMessage: string, conversationHistory: ChatMessage[] = []): Promise<ChatMessage> {
  setToolContext(userId);
  try {
    const graph = await createAgentGraph();

    const messages: BaseMessage[] = conversationHistory.map(m => {
      if (m.role === 'user') return new HumanMessage(m.content);
      return new AIMessage(m.content);
    });

    messages.push(new HumanMessage(userMessage));

    const result = await graph.invoke({
      messages,
      userId,
    });

    const lastMsg = result.messages[result.messages.length - 1];
    const content = typeof lastMsg.content === 'string' ? lastMsg.content : JSON.stringify(lastMsg.content);

    return {
      role: 'assistant',
      content,
      toolCalls: (lastMsg as any).tool_calls || undefined,
      timestamp: new Date(),
    };
  } finally {
    clearToolContext();
  }
}
