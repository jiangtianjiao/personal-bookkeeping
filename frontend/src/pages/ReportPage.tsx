import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Tabs,
  Table,
  DatePicker,
  Button,
  Row,
  Col,
  Statistic,
  message,
  Spin,
  Radio,
  Tag,
} from 'antd';
import { SearchOutlined, PrinterOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { PieChart, LineChart, BarChart } from 'echarts/charts';
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { apiService } from '../services/api';
import type { BalanceSheetData, AccountBalance, IncomeExpenseData, CategorySummary } from '../types';
import { formatAmount } from '../utils/format';
import { useIsMobile } from '../hooks/useIsMobile';

echarts.use([
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  PieChart,
  LineChart,
  BarChart,
  CanvasRenderer,
]);

const { RangePicker } = DatePicker;

// ---------- 试算平衡表类型 ----------
interface TrialBalanceAccount {
  id: string;
  name: string;
  accountType: string;
  debit: number;
  credit: number;
  balance: number;
}

interface TrialBalanceData {
  accounts: TrialBalanceAccount[];
  totals: {
    debits: number;
    credits: number;
    isBalanced: boolean;
  };
}

// ---------- 趋势粒度类型 ----------
type TrendGranularity = 'week' | 'month' | 'quarter' | 'year';

// ---------- 打印样式 ----------
const printStyleId = 'report-print-style';
const ensurePrintStyle = () => {
  if (document.getElementById(printStyleId)) return;
  const style = document.createElement('style');
  style.id = printStyleId;
  style.textContent = `
    @media print {
      body * { visibility: hidden; }
      .report-print-area, .report-print-area * { visibility: visible; }
      .report-print-area { position: absolute; left: 0; top: 0; width: 100%; }
      nav, aside, .ant-layout-sider, .ant-layout-header, .ant-tabs-nav { display: none !important; }
    }
  `;
  document.head.appendChild(style);
};

const ReportPage: React.FC = () => {
  const isMobile = useIsMobile();

  // ========== Tab 1: 收支分析 ==========
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().startOf('month'),
    dayjs().endOf('month'),
  ]);
  const [incomeExpense, setIncomeExpense] = useState<IncomeExpenseData | null>(null);
  const [ieLoading, setIeLoading] = useState(false);

  const fetchIncomeExpense = async () => {
    if (!dateRange[0] || !dateRange[1]) return;
    setIeLoading(true);
    try {
      const data = await apiService.get<IncomeExpenseData>(
        `/reports/income-expense?startDate=${dateRange[0].format('YYYY-MM-DD')}&endDate=${dateRange[1].format('YYYY-MM-DD')}`
      );
      setIncomeExpense(data);
    } catch {
      message.error('获取收支报表失败');
    } finally {
      setIeLoading(false);
    }
  };

  // ========== Tab 2: 趋势分析 ==========
  const [trendGranularity, setTrendGranularity] = useState<TrendGranularity>('month');
  const [trendData, setTrendData] = useState<{ label: string; income: number; expense: number }[]>([]);
  const [trendLoading, setTrendLoading] = useState(false);

  const fetchTrendData = useCallback(async () => {
    setTrendLoading(true);
    try {
      const granularityMap: Record<TrendGranularity, string> = {
        week: 'weekly',
        month: 'monthly',
        quarter: 'quarterly',
        year: 'yearly',
      };
      const data = await apiService.get<Array<{ period: { startDate: string; endDate: string }; income: number; expense: number }>>(
        '/reports/trend',
        { params: { granularity: granularityMap[trendGranularity], periods: 12 } },
      );

      const formatted = data.map((item) => ({
        label: item.period.startDate,
        income: item.income,
        expense: item.expense,
      }));
      setTrendData(formatted);
    } catch {
      message.error('获取趋势数据失败');
    } finally {
      setTrendLoading(false);
    }
  }, [trendGranularity]);

  // ========== Tab 3: 资产净值 ==========
  const [balanceSheetDate, setBalanceSheetDate] = useState(dayjs());
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheetData | null>(null);
  const [bsLoading, setBsLoading] = useState(false);
  const [netWorthTrend, setNetWorthTrend] = useState<{ label: string; assets: number; liabilities: number; netWorth: number }[]>([]);
  const [nwLoading, setNwLoading] = useState(false);

  const fetchBalanceSheet = async () => {
    if (!balanceSheetDate) return;
    setBsLoading(true);
    try {
      const data = await apiService.get<BalanceSheetData>(
        `/reports/balance-sheet?date=${balanceSheetDate.format('YYYY-MM-DD')}`
      );
      setBalanceSheet(data);
    } catch {
      message.error('获取资产负债表失败');
    } finally {
      setBsLoading(false);
    }
  };

  const fetchNetWorthTrend = useCallback(async () => {
    setNwLoading(true);
    try {
      const now = dayjs();
      const months: { date: dayjs.Dayjs; label: string }[] = [];
      for (let i = 11; i >= 0; i--) {
        const d = now.subtract(i, 'month').endOf('month');
        months.push({ date: d, label: d.format('YYYY-MM') });
      }
      const results = await Promise.all(
        months.map((m) =>
          apiService
            .get<BalanceSheetData>(`/reports/balance-sheet?date=${m.date.format('YYYY-MM-DD')}`)
            .then((d) => ({
              label: m.label,
              assets: d.totalAssets,
              liabilities: d.totalLiabilities,
              netWorth: d.netWorth,
            }))
            .catch(() => ({ label: m.label, assets: 0, liabilities: 0, netWorth: 0 }))
        )
      );
      setNetWorthTrend(results);
    } catch {
      message.error('获取净资产趋势失败');
    } finally {
      setNwLoading(false);
    }
  }, []);

  // ========== Tab 5: 试算平衡表 ==========
  const [trialBalance, setTrialBalance] = useState<TrialBalanceData | null>(null);
  const [tbLoading, setTbLoading] = useState(false);

  const fetchTrialBalance = async () => {
    setTbLoading(true);
    try {
      const data = await apiService.get<TrialBalanceData>('/reports/trial-balance');
      setTrialBalance(data);
    } catch {
      message.error('获取试算平衡表失败');
    } finally {
      setTbLoading(false);
    }
  };

  // ========== 初始化加载 ==========
  useEffect(() => {
    fetchBalanceSheet();
    ensurePrintStyle();
  }, []);

  // ========== 共用列定义 ==========
  const balanceColumns: ColumnsType<AccountBalance> = [
    { title: '账户', dataIndex: 'accountName', key: 'accountName' },
    ...(isMobile
      ? []
      : [
          {
            title: '类型' as const,
            dataIndex: 'accountType' as const,
            key: 'accountType' as const,
            width: 80,
            render: (type: string) => {
              const labels: Record<string, string> = { asset: '资产', liability: '负债' };
              const colors: Record<string, string> = { asset: '#4f46e5', liability: '#ef4444' };
              return labels[type] ? (
                <span style={{ color: colors[type], fontWeight: 500, fontSize: 13 }}>{labels[type]}</span>
              ) : (
                '-'
              );
            },
          },
        ]),
    {
      title: '余额',
      dataIndex: 'balance',
      key: 'balance',
      align: 'right' as const,
      width: isMobile ? 100 : 140,
      render: (balance: number) => <span style={{ fontWeight: 500 }}>{formatAmount(balance)}</span>,
    },
  ];

  const categoryColumns: ColumnsType<CategorySummary> = [
    { title: '分类', dataIndex: 'categoryName', key: 'categoryName' },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      align: 'right' as const,
      width: isMobile ? 90 : 140,
      render: (amount: number) => <span style={{ fontWeight: 500 }}>{formatAmount(amount)}</span>,
    },
    {
      title: '占比',
      dataIndex: 'percentage',
      key: 'percentage',
      width: 70,
      render: (percentage: number) => <span style={{ color: '#64748b' }}>{percentage.toFixed(1)}%</span>,
    },
  ];

  // ========== 图表配置 ==========
  const getPieChartOption = (data: CategorySummary[], title: string, color: string) => ({
    tooltip: { trigger: 'item' as const, formatter: '{b}: {c} ({d}%)' },
    legend: { orient: 'vertical' as const, left: 'left', textStyle: { fontSize: 12 } },
    series: [
      {
        name: title,
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
        label: { show: false, position: 'center' as const },
        emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold' } },
        labelLine: { show: false },
        data: data.map((item) => ({ name: item.categoryName, value: item.amount })),
        color:
          color === 'income'
            ? ['#06b6d4', '#22d3ee', '#67e8f9', '#a5f3fc', '#cffafe']
            : ['#f59e0b', '#fbbf24', '#fcd34d', '#fde68a', '#fef3c7'],
      },
    ],
  });

  const getTrendLineOption = () => ({
    tooltip: {
      trigger: 'axis' as const,
      formatter: (params: any) => {
        const items = Array.isArray(params) ? params : [params];
        let html = `<b>${items[0]?.axisValue}</b><br/>`;
        items.forEach((p: any) => {
          html += `${p.marker} ${p.seriesName}: ${formatAmount(p.value)}<br/>`;
        });
        return html;
      },
    },
    legend: { data: ['收入', '支出'] },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category' as const, data: trendData.map((d) => d.label), boundaryGap: false },
    yAxis: {
      type: 'value' as const,
      axisLabel: { formatter: (v: number) => (v >= 10000 ? `${(v / 10000).toFixed(0)}万` : `${v}`) },
    },
    series: [
      {
        name: '收入',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { width: 2, color: '#10b981' },
        itemStyle: { color: '#10b981' },
        areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(16,185,129,0.25)' },
          { offset: 1, color: 'rgba(16,185,129,0.02)' },
        ]) },
        data: trendData.map((d) => d.income),
      },
      {
        name: '支出',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { width: 2, color: '#ef4444' },
        itemStyle: { color: '#ef4444' },
        areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(239,68,68,0.25)' },
          { offset: 1, color: 'rgba(239,68,68,0.02)' },
        ]) },
        data: trendData.map((d) => d.expense),
      },
    ],
  });

  const getBalanceBarOption = () => ({
    tooltip: {
      trigger: 'axis' as const,
      formatter: (params: any) => {
        const p = Array.isArray(params) ? params[0] : params;
        return `<b>${p.axisValue}</b><br/>${p.marker} 结余: ${formatAmount(p.value)}`;
      },
    },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category' as const, data: trendData.map((d) => d.label) },
    yAxis: {
      type: 'value' as const,
      axisLabel: { formatter: (v: number) => (v >= 10000 ? `${(v / 10000).toFixed(0)}万` : `${v}`) },
    },
    series: [
      {
        name: '结余',
        type: 'bar',
        barWidth: '50%',
        data: trendData.map((d) => ({
          value: d.income - d.expense,
          itemStyle: { color: d.income - d.expense >= 0 ? '#10b981' : '#ef4444', borderRadius: [4, 4, 0, 0] },
        })),
      },
    ],
  });

  const getNetWorthLineOption = () => ({
    tooltip: {
      trigger: 'axis' as const,
      formatter: (params: any) => {
        const items = Array.isArray(params) ? params : [params];
        let html = `<b>${items[0]?.axisValue}</b><br/>`;
        items.forEach((p: any) => {
          html += `${p.marker} ${p.seriesName}: ${formatAmount(p.value)}<br/>`;
        });
        return html;
      },
    },
    legend: { data: ['总资产', '总负债', '净资产'] },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category' as const, data: netWorthTrend.map((d) => d.label), boundaryGap: false },
    yAxis: {
      type: 'value' as const,
      axisLabel: { formatter: (v: number) => (v >= 10000 ? `${(v / 10000).toFixed(0)}万` : `${v}`) },
    },
    series: [
      {
        name: '总资产',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 5,
        lineStyle: { width: 2, color: '#4f46e5' },
        itemStyle: { color: '#4f46e5' },
        data: netWorthTrend.map((d) => d.assets),
      },
      {
        name: '总负债',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 5,
        lineStyle: { width: 2, color: '#ef4444' },
        itemStyle: { color: '#ef4444' },
        data: netWorthTrend.map((d) => d.liabilities),
      },
      {
        name: '净资产',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 5,
        lineStyle: { width: 3, color: '#10b981' },
        itemStyle: { color: '#10b981' },
        areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(16,185,129,0.2)' },
          { offset: 1, color: 'rgba(16,185,129,0.02)' },
        ]) },
        data: netWorthTrend.map((d) => d.netWorth),
      },
    ],
  });

  const getAssetLiabilityPieOption = (items: AccountBalance[], title: string, colors: string[]) => ({
    tooltip: { trigger: 'item' as const, formatter: '{b}: {c} ({d}%)' },
    legend: { orient: 'vertical' as const, left: 'left', textStyle: { fontSize: 12 } },
    series: [
      {
        name: title,
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
        label: { show: false, position: 'center' as const },
        emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold' } },
        labelLine: { show: false },
        data: items.map((a) => ({ name: a.accountName, value: Math.abs(a.balance) })),
        color: colors,
      },
    ],
  });

  const getRankBarOption = (data: CategorySummary[], _title: string, color: string) => {
    const sorted = [...data].sort((a, b) => a.amount - b.amount).slice(-10);
    return {
      tooltip: {
        trigger: 'axis' as const,
        formatter: (params: any) => {
          const p = Array.isArray(params) ? params[0] : params;
          return `${p.name}: ${formatAmount(p.value)}`;
        },
      },
      grid: { left: '3%', right: '8%', bottom: '3%', top: '3%', containLabel: true },
      xAxis: {
        type: 'value' as const,
        axisLabel: { formatter: (v: number) => (v >= 10000 ? `${(v / 10000).toFixed(0)}万` : `${v}`) },
      },
      yAxis: {
        type: 'category' as const,
        data: sorted.map((d) => d.categoryName),
        axisLabel: { fontSize: 12 },
      },
      series: [
        {
          type: 'bar',
          data: sorted.map((d) => d.amount),
          barWidth: '60%',
          itemStyle: { color, borderRadius: [0, 4, 4, 0] },
          label: { show: true, position: 'right' as const, formatter: (p: any) => formatAmount(p.value), fontSize: 11 },
        },
      ],
    };
  };

  // ========== 打印 ==========
  const handlePrint = () => {
    window.print();
  };

  // ========== 试算平衡表列定义 ==========
  const trialBalanceColumns: ColumnsType<TrialBalanceAccount> = [
    { title: '账户', dataIndex: 'name', key: 'name' },
    ...(isMobile
      ? []
      : [
          {
            title: '类型' as const,
            dataIndex: 'accountType' as const,
            key: 'accountType' as const,
            width: 80,
            render: (type: string) => {
              const labels: Record<string, string> = { asset: '资产', liability: '负债', income: '收入', expense: '支出' };
              return <span style={{ fontSize: 13 }}>{labels[type] || type}</span>;
            },
          },
        ]),
    {
      title: '借方合计',
      dataIndex: 'debit',
      key: 'debit',
      align: 'right' as const,
      width: isMobile ? 100 : 140,
      render: (v: number) => <span style={{ fontWeight: 500 }}>{formatAmount(v)}</span>,
    },
    {
      title: '贷方合计',
      dataIndex: 'credit',
      key: 'credit',
      align: 'right' as const,
      width: isMobile ? 100 : 140,
      render: (v: number) => <span style={{ fontWeight: 500 }}>{formatAmount(v)}</span>,
    },
    {
      title: '余额',
      dataIndex: 'balance',
      key: 'balance',
      align: 'right' as const,
      width: isMobile ? 100 : 140,
      render: (v: number) => (
        <span style={{ fontWeight: 500, color: v >= 0 ? '#10b981' : '#ef4444' }}>{formatAmount(v)}</span>
      ),
    },
  ];

  return (
    <div className="report-print-area">
      <Row justify="space-between" align="middle" style={{ marginBottom: 8 }}>
        <Col>
          <h1 className="page-title" style={{ marginBottom: 0 }}>财务报表</h1>
        </Col>
        <Col>
          <Button icon={<PrinterOutlined />} onClick={handlePrint} size="small">
            打印报表
          </Button>
        </Col>
      </Row>

      <Tabs
        defaultActiveKey="incomeExpense"
        items={[
          // ==================== Tab 1: 收支分析 ====================
          {
            key: 'incomeExpense',
            label: '收支分析',
            children: (
              <div>
                <Card size="small" style={{ marginBottom: 12 }}>
                  <Row gutter={[8, 8]} align="middle">
                    <Col xs={24} sm="auto">
                      <span style={{ fontSize: 13, color: '#64748b' }}>统计区间</span>
                    </Col>
                    <Col xs={24} sm="auto">
                      <RangePicker
                        value={dateRange}
                        onChange={(dates) => {
                          if (dates && dates[0] && dates[1]) setDateRange([dates[0], dates[1]]);
                        }}
                        style={{ width: isMobile ? '100%' : undefined }}
                        size="small"
                      />
                    </Col>
                    <Col>
                      <Button type="primary" icon={<SearchOutlined />} onClick={fetchIncomeExpense} loading={ieLoading} size="small">
                        查询
                      </Button>
                    </Col>
                  </Row>
                </Card>

                {ieLoading ? (
                  <div style={{ textAlign: 'center', padding: '60px 0' }}>
                    <Spin size="large" />
                  </div>
                ) : incomeExpense ? (
                  <>
                    <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
                      <Col xs={24} sm={8}>
                        <Card size="small" className="stat-card">
                          <Statistic title="总收入" value={incomeExpense.totalIncome} precision={2} suffix="元" valueStyle={{ color: '#06b6d4' }} />
                        </Card>
                      </Col>
                      <Col xs={24} sm={8}>
                        <Card size="small" className="stat-card">
                          <Statistic title="总支出" value={incomeExpense.totalExpenses} precision={2} suffix="元" valueStyle={{ color: '#f59e0b' }} />
                        </Card>
                      </Col>
                      <Col xs={24} sm={8}>
                        <Card size="small" className="stat-card">
                          <Statistic
                            title="结余"
                            value={incomeExpense.netIncome}
                            precision={2}
                            suffix="元"
                            valueStyle={{ color: incomeExpense.netIncome >= 0 ? '#10b981' : '#ef4444' }}
                          />
                        </Card>
                      </Col>
                    </Row>

                    <Row gutter={[12, 12]}>
                      <Col xs={24} lg={12}>
                        <Card title={<span style={{ fontWeight: 600 }}>收入明细</span>} size="small">
                          {incomeExpense.income.length > 0 ? (
                            <>
                              <ReactEChartsCore
                                echarts={echarts}
                                option={getPieChartOption(incomeExpense.income, '收入', 'income')}
                                style={{ height: isMobile ? 200 : 250 }}
                              />
                              <Table columns={categoryColumns} dataSource={incomeExpense.income} rowKey="categoryId" pagination={false} size="small" />
                            </>
                          ) : (
                            <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>暂无收入数据</div>
                          )}
                        </Card>
                      </Col>
                      <Col xs={24} lg={12}>
                        <Card title={<span style={{ fontWeight: 600 }}>支出明细</span>} size="small">
                          {incomeExpense.expenses.length > 0 ? (
                            <>
                              <ReactEChartsCore
                                echarts={echarts}
                                option={getPieChartOption(incomeExpense.expenses, '支出', 'expense')}
                                style={{ height: isMobile ? 200 : 250 }}
                              />
                              <Table columns={categoryColumns} dataSource={incomeExpense.expenses} rowKey="categoryId" pagination={false} size="small" />
                            </>
                          ) : (
                            <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>暂无支出数据</div>
                          )}
                        </Card>
                      </Col>
                    </Row>
                  </>
                ) : null}
              </div>
            ),
          },

          // ==================== Tab 2: 趋势分析 ====================
          {
            key: 'trend',
            label: '趋势分析',
            children: (
              <div>
                <Card size="small" style={{ marginBottom: 12 }}>
                  <Row gutter={[8, 8]} align="middle">
                    <Col xs={24} sm="auto">
                      <span style={{ fontSize: 13, color: '#64748b' }}>统计粒度</span>
                    </Col>
                    <Col xs={24} sm="auto">
                      <Radio.Group
                        value={trendGranularity}
                        onChange={(e) => setTrendGranularity(e.target.value)}
                        optionType="button"
                        buttonStyle="solid"
                        size="small"
                      >
                        <Radio.Button value="week">按周</Radio.Button>
                        <Radio.Button value="month">按月</Radio.Button>
                        <Radio.Button value="quarter">按季</Radio.Button>
                        <Radio.Button value="year">按年</Radio.Button>
                      </Radio.Group>
                    </Col>
                    <Col>
                      <Button type="primary" icon={<SearchOutlined />} onClick={fetchTrendData} loading={trendLoading} size="small">
                        查询
                      </Button>
                    </Col>
                  </Row>
                </Card>

                {trendLoading ? (
                  <div style={{ textAlign: 'center', padding: '60px 0' }}>
                    <Spin size="large" />
                  </div>
                ) : trendData.length > 0 ? (
                  <>
                    <Card title={<span style={{ fontWeight: 600 }}>收支趋势</span>} size="small" style={{ marginBottom: 12 }}>
                      <ReactEChartsCore echarts={echarts} option={getTrendLineOption()} style={{ height: isMobile ? 250 : 350 }} />
                    </Card>
                    <Card title={<span style={{ fontWeight: 600 }}>结余趋势</span>} size="small">
                      <ReactEChartsCore echarts={echarts} option={getBalanceBarOption()} style={{ height: isMobile ? 200 : 300 }} />
                    </Card>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>点击「查询」加载趋势数据</div>
                )}
              </div>
            ),
          },

          // ==================== Tab 3: 资产净值 ====================
          {
            key: 'netWorth',
            label: '资产净值',
            children: (
              <div>
                <Card size="small" style={{ marginBottom: 12 }}>
                  <Row gutter={[8, 8]} align="middle">
                    <Col xs={24} sm="auto">
                      <span style={{ fontSize: 13, color: '#64748b' }}>报表日期</span>
                    </Col>
                    <Col xs={24} sm="auto">
                      <DatePicker
                        value={balanceSheetDate}
                        onChange={(date) => date && setBalanceSheetDate(date)}
                        style={{ width: isMobile ? '100%' : undefined }}
                        size="small"
                      />
                    </Col>
                    <Col>
                      <Button type="primary" icon={<SearchOutlined />} onClick={fetchBalanceSheet} loading={bsLoading} size="small">
                        查询
                      </Button>
                    </Col>
                    <Col>
                      <Button onClick={fetchNetWorthTrend} loading={nwLoading} size="small">
                        加载趋势
                      </Button>
                    </Col>
                  </Row>
                </Card>

                {bsLoading ? (
                  <div style={{ textAlign: 'center', padding: '60px 0' }}>
                    <Spin size="large" />
                  </div>
                ) : balanceSheet ? (
                  <>
                    <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
                      <Col xs={24} sm={8}>
                        <Card size="small" className="stat-card">
                          <Statistic title="总资产" value={balanceSheet.totalAssets} precision={2} suffix="元" valueStyle={{ color: '#4f46e5' }} />
                        </Card>
                      </Col>
                      <Col xs={24} sm={8}>
                        <Card size="small" className="stat-card">
                          <Statistic title="总负债" value={balanceSheet.totalLiabilities} precision={2} suffix="元" valueStyle={{ color: '#ef4444' }} />
                        </Card>
                      </Col>
                      <Col xs={24} sm={8}>
                        <Card size="small" className="stat-card">
                          <Statistic title="净资产" value={balanceSheet.netWorth} precision={2} suffix="元" valueStyle={{ color: '#10b981' }} />
                        </Card>
                      </Col>
                    </Row>

                    {/* 资产/负债构成饼图 */}
                    <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
                      <Col xs={24} lg={12}>
                        <Card title={<span style={{ fontWeight: 600 }}>资产构成</span>} size="small">
                          {balanceSheet.assets.length > 0 ? (
                            <ReactEChartsCore
                              echarts={echarts}
                              option={getAssetLiabilityPieOption(balanceSheet.assets, '资产构成', [
                                '#4f46e5', '#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe',
                              ])}
                              style={{ height: isMobile ? 200 : 250 }}
                            />
                          ) : (
                            <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>暂无资产数据</div>
                          )}
                        </Card>
                      </Col>
                      <Col xs={24} lg={12}>
                        <Card title={<span style={{ fontWeight: 600 }}>负债构成</span>} size="small">
                          {balanceSheet.liabilities.length > 0 ? (
                            <ReactEChartsCore
                              echarts={echarts}
                              option={getAssetLiabilityPieOption(balanceSheet.liabilities, '负债构成', [
                                '#ef4444', '#f87171', '#fca5a5', '#fecaca', '#fee2e2',
                              ])}
                              style={{ height: isMobile ? 200 : 250 }}
                            />
                          ) : (
                            <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>暂无负债数据</div>
                          )}
                        </Card>
                      </Col>
                    </Row>

                    {/* 资产/负债明细表 */}
                    <Card title={<span style={{ fontWeight: 600 }}>资产</span>} size="small" style={{ marginBottom: 12 }}>
                      <Table columns={balanceColumns} dataSource={balanceSheet.assets} rowKey="accountId" pagination={false} size="small" />
                    </Card>
                    <Card title={<span style={{ fontWeight: 600 }}>负债</span>} size="small" style={{ marginBottom: 12 }}>
                      <Table columns={balanceColumns} dataSource={balanceSheet.liabilities} rowKey="accountId" pagination={false} size="small" />
                    </Card>

                    {/* 净资产趋势 */}
                    {nwLoading ? (
                      <div style={{ textAlign: 'center', padding: '40px 0' }}>
                        <Spin />
                      </div>
                    ) : netWorthTrend.length > 0 ? (
                      <Card title={<span style={{ fontWeight: 600 }}>净资产趋势（近 12 个月）</span>} size="small">
                        <ReactEChartsCore echarts={echarts} option={getNetWorthLineOption()} style={{ height: isMobile ? 250 : 350 }} />
                      </Card>
                    ) : null}
                  </>
                ) : null}
              </div>
            ),
          },

          // ==================== Tab 4: 分类排行 ====================
          {
            key: 'ranking',
            label: '分类排行',
            children: (
              <div>
                <Card size="small" style={{ marginBottom: 12 }}>
                  <Row gutter={[8, 8]} align="middle">
                    <Col xs={24} sm="auto">
                      <span style={{ fontSize: 13, color: '#64748b' }}>统计区间</span>
                    </Col>
                    <Col xs={24} sm="auto">
                      <RangePicker
                        value={dateRange}
                        onChange={(dates) => {
                          if (dates && dates[0] && dates[1]) setDateRange([dates[0], dates[1]]);
                        }}
                        style={{ width: isMobile ? '100%' : undefined }}
                        size="small"
                      />
                    </Col>
                    <Col>
                      <Button type="primary" icon={<SearchOutlined />} onClick={fetchIncomeExpense} loading={ieLoading} size="small">
                        查询
                      </Button>
                    </Col>
                  </Row>
                </Card>

                {ieLoading ? (
                  <div style={{ textAlign: 'center', padding: '60px 0' }}>
                    <Spin size="large" />
                  </div>
                ) : incomeExpense ? (
                  <Row gutter={[12, 12]}>
                    <Col xs={24} lg={12}>
                      <Card title={<span style={{ fontWeight: 600 }}>支出 Top 10</span>} size="small">
                        {incomeExpense.expenses.length > 0 ? (
                          <ReactEChartsCore
                            echarts={echarts}
                            option={getRankBarOption(incomeExpense.expenses, '支出排行', '#f59e0b')}
                            style={{ height: isMobile ? 300 : 400 }}
                          />
                        ) : (
                          <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>暂无支出数据</div>
                        )}
                      </Card>
                    </Col>
                    <Col xs={24} lg={12}>
                      <Card title={<span style={{ fontWeight: 600 }}>收入 Top 10</span>} size="small">
                        {incomeExpense.income.length > 0 ? (
                          <ReactEChartsCore
                            echarts={echarts}
                            option={getRankBarOption(incomeExpense.income, '收入排行', '#06b6d4')}
                            style={{ height: isMobile ? 300 : 400 }}
                          />
                        ) : (
                          <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>暂无收入数据</div>
                        )}
                      </Card>
                    </Col>
                  </Row>
                ) : (
                  <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>请选择日期区间后点击「查询」</div>
                )}
              </div>
            ),
          },

          // ==================== Tab 5: 试算平衡表 ====================
          {
            key: 'trialBalance',
            label: '试算平衡表',
            children: (
              <div>
                <Card size="small" style={{ marginBottom: 12 }}>
                  <Row gutter={[8, 8]} align="middle">
                    <Col>
                      <Button type="primary" icon={<SearchOutlined />} onClick={fetchTrialBalance} loading={tbLoading} size="small">
                        加载试算平衡表
                      </Button>
                    </Col>
                  </Row>
                </Card>

                {tbLoading ? (
                  <div style={{ textAlign: 'center', padding: '60px 0' }}>
                    <Spin size="large" />
                  </div>
                ) : trialBalance ? (
                  <Card size="small">
                    <Table
                      columns={trialBalanceColumns}
                      dataSource={trialBalance.accounts}
                      rowKey="id"
                      pagination={false}
                      size="small"
                      summary={() => (
                        <Table.Summary fixed>
                          <Table.Summary.Row style={{ fontWeight: 700, background: '#fafafa' }}>
                            <Table.Summary.Cell index={0} colSpan={isMobile ? 1 : 2}>
                              合计
                            </Table.Summary.Cell>
                            <Table.Summary.Cell index={isMobile ? 1 : 2} align="right">
                              {formatAmount(trialBalance.totals?.debits)}
                            </Table.Summary.Cell>
                            <Table.Summary.Cell index={isMobile ? 2 : 3} align="right">
                              {formatAmount(trialBalance.totals?.credits)}
                            </Table.Summary.Cell>
                            <Table.Summary.Cell index={isMobile ? 3 : 4} align="right">
                              <Tag color={trialBalance.totals?.isBalanced ? 'success' : 'error'} style={{ fontWeight: 600 }}>
                                {trialBalance.totals?.isBalanced ? '已平衡' : '未平衡'}
                              </Tag>
                            </Table.Summary.Cell>
                          </Table.Summary.Row>
                        </Table.Summary>
                      )}
                    />
                  </Card>
                ) : (
                  <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>点击「加载试算平衡表」查看数据</div>
                )}
              </div>
            ),
          },
        ]}
      />
    </div>
  );
};

export default ReportPage;
