import React, { useMemo } from 'react';
import { View, Text, Dimensions } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Line, Text as SvgText, G, Circle } from 'react-native-svg';
import { t } from '@/utils/translation';

export interface ChartDataPoint {
  label: string;
  sales: number;
  expenses: number;
}

interface SalesChartProps {
  data: ChartDataPoint[];
}

export function SalesChart({ data }: SalesChartProps) {
  const screenWidth = Dimensions.get('window').width - 32; // 16px padding on sides
  const svgWidth = screenWidth;
  const svgHeight = 220;
  const paddingLeft = 40;
  const paddingRight = 10;
  const paddingTop = 20;
  const paddingBottom = 25;

  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = svgHeight - paddingTop - paddingBottom;

  const maxVal = useMemo(() => {
    const allValues = data.flatMap((d) => [d.sales, d.expenses]);
    const max = Math.max(...allValues, 1000);
    return Math.ceil(max * 1.1); // add 10% buffer
  }, [data]);

  const points = useMemo(() => {
    if (data.length === 0) return { salesPoints: [], expensePoints: [] };

    const n = data.length;
    const xStep = n > 1 ? chartWidth / (n - 1) : 0;

    const salesPoints = data.map((d, i) => {
      const x = n === 1 ? paddingLeft + chartWidth / 2 : paddingLeft + i * xStep;
      const y = paddingTop + chartHeight - (d.sales / maxVal) * chartHeight;
      return { x, y, val: d.sales, label: d.label };
    });

    const expensePoints = data.map((d, i) => {
      const x = n === 1 ? paddingLeft + chartWidth / 2 : paddingLeft + i * xStep;
      const y = paddingTop + chartHeight - (d.expenses / maxVal) * chartHeight;
      return { x, y, val: d.expenses };
    });

    return { salesPoints, expensePoints };
  }, [data, chartWidth, chartHeight, maxVal]);

  const { salesPoints, expensePoints } = points;

  const salesPathString = useMemo(() => {
    if (salesPoints.length === 0) return '';
    return salesPoints.reduce(
      (path, pt, i) => (i === 0 ? `M ${pt.x} ${pt.y}` : `${path} L ${pt.x} ${pt.y}`),
      ''
    );
  }, [salesPoints]);

  const salesAreaPathString = useMemo(() => {
    if (salesPoints.length === 0) return '';
    const startPoint = `M ${salesPoints[0].x} ${paddingTop + chartHeight}`;
    const curvePoints = salesPoints.reduce((path, pt) => `${path} L ${pt.x} ${pt.y}`, '');
    const endPoint = `L ${salesPoints[salesPoints.length - 1].x} ${paddingTop + chartHeight} Z`;
    return `${startPoint} ${curvePoints} ${endPoint}`;
  }, [salesPoints, chartHeight]);

  const expensePathString = useMemo(() => {
    if (expensePoints.length === 0) return '';
    return expensePoints.reduce(
      (path, pt, i) => (i === 0 ? `M ${pt.x} ${pt.y}` : `${path} L ${pt.x} ${pt.y}`),
      ''
    );
  }, [expensePoints]);

  const yGridLines = useMemo(() => {
    return Array.from({ length: 4 }).map((_, idx) => {
      const val = (maxVal / 3) * idx;
      const y = paddingTop + chartHeight - (val / maxVal) * chartHeight;
      return { y, val: Math.round(val) };
    });
  }, [maxVal, paddingTop, chartHeight]);

  return (
    <View className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm w-full mb-6">
      <View className="flex-row items-center justify-between border-b border-slate-100 pb-3 mb-4">
        <View>
          <Text className="text-sm font-bold text-slate-800 font-sans">
            {t('save') === 'সেভ করুন' ? 'বিক্রি ও খরচের চার্ট' : 'Sales & Expenses Chart'}
          </Text>
          <Text className="text-[10px] text-slate-400 font-medium font-sans">
            {t('save') === 'সেভ করুন' ? 'Sales & Expense Trends' : 'Sales & Expense Trends'}
          </Text>
        </View>
        <View className="flex-row items-center">
          <View className="flex-row items-center mr-3">
            <View className="h-2 w-2 rounded-full bg-primary mr-1" />
            <Text className="text-[10px] font-semibold text-slate-600 font-sans">
              {t('save') === 'সেভ করুন' ? 'বিক্রি (Sales)' : 'Sales'}
            </Text>
          </View>
          <View className="flex-row items-center">
            <View className="h-2 w-2 rounded-full bg-rose-400 mr-1" />
            <Text className="text-[10px] font-semibold text-slate-600 font-sans">
              {t('save') === 'সেভ করুন' ? 'খরচ (Expenses)' : 'Expenses'}
            </Text>
          </View>
        </View>
      </View>

      <View className="w-full h-[220px]">
        <Svg width={svgWidth} height={svgHeight}>
          <Defs>
            <LinearGradient id="sales-gradient" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#4f46e5" stopOpacity="0.25" />
              <Stop offset="1" stopColor="#4f46e5" stopOpacity="0.0" />
            </LinearGradient>
          </Defs>

          {yGridLines.map((line, idx) => (
            <G key={idx}>
              <Line
                x1={paddingLeft}
                y1={line.y}
                x2={svgWidth - paddingRight}
                y2={line.y}
                stroke="#f1f5f9"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <SvgText
                x={paddingLeft - 8}
                y={line.y + 3}
                fill="#94a3b8"
                fontSize="9"
                fontWeight="600"
                textAnchor="end"
              >
                ৳{line.val >= 1000 ? `${(line.val / 1000).toFixed(1)}k` : line.val}
              </SvgText>
            </G>
          ))}

          {salesAreaPathString ? (
            <Path d={salesAreaPathString} fill="url(#sales-gradient)" />
          ) : null}

          {salesPathString ? (
            <Path
              d={salesPathString}
              fill="none"
              stroke="#4f46e5"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          ) : null}

          {expensePathString ? (
            <Path
              d={expensePathString}
              fill="none"
              stroke="#fb7185"
              strokeWidth="2"
              strokeDasharray="3 3"
              strokeLinecap="round"
            />
          ) : null}

          {salesPoints.map((pt, idx) => (
            <G key={`dots-${idx}`}>
              <Circle
                cx={pt.x}
                cy={pt.y}
                r="3.5"
                fill="#ffffff"
                stroke="#4f46e5"
                strokeWidth="2"
              />
            </G>
          ))}

          {salesPoints.map((pt, idx) => (
            <SvgText
              key={`x-label-${idx}`}
              x={pt.x}
              y={svgHeight - 8}
              fill="#94a3b8"
              fontSize="9"
              fontWeight="bold"
              textAnchor="middle"
            >
              {pt.label}
            </SvgText>
          ))}
        </Svg>
      </View>
    </View>
  );
}
