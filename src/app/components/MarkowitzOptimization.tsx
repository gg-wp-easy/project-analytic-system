import { useState } from "react";
import { PieChart, Settings, TrendingUp, Shield, Percent, Calculator } from "lucide-react";
import { PieChart as RechartsPie, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter, ZAxis } from "recharts";

export function MarkowitzOptimization() {
  const [params, setParams] = useState({
    minWeight: "0",
    maxWeight: "30",
    riskFreeRate: "4.5",
  });

  const [optimizationRun, setOptimizationRun] = useState(false);

  // Данные эффективной границы
  const efficientFrontier = Array.from({ length: 50 }, (_, i) => ({
    risk: 10 + i * 0.5,
    return: 8 + Math.sqrt(i) * 2 + Math.random() * 2,
  }));

  // Оптимальные портфели
  const optimalPortfolios = [
    { name: "Макс Шарпа", risk: 18, return: 22, sharpe: 0.97, type: "sharpe" },
    { name: "Мин Волатильность", risk: 12, return: 14, sharpe: 0.68, type: "minvol" },
  ];

  // Веса активов для портфеля с максимальным коэффициентом Шарпа
  const maxSharpeWeights = [
    { name: "AAPL", value: 25, color: "#3b82f6" },
    { name: "MSFT", value: 22, color: "#8b5cf6" },
    { name: "GOOGL", value: 18, color: "#ec4899" },
    { name: "AMZN", value: 15, color: "#f59e0b" },
    { name: "TSLA", value: 12, color: "#10b981" },
    { name: "NVDA", value: 8, color: "#ef4444" },
  ];

  // Веса активов для портфеля с минимальной волатильностью
  const minVolWeights = [
    { name: "AAPL", value: 20, color: "#3b82f6" },
    { name: "MSFT", value: 18, color: "#8b5cf6" },
    { name: "GOOGL", value: 16, color: "#ec4899" },
    { name: "AMZN", value: 15, color: "#f59e0b" },
    { name: "JNJ", value: 14, color: "#10b981" },
    { name: "PG", value: 12, color: "#ef4444" },
    { name: "KO", value: 5, color: "#06b6d4" },
  ];

  const handleOptimize = () => {
    setOptimizationRun(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          <PieChart className="w-8 h-8" />
          <h1 className="text-3xl font-bold">Оптимизация по Марковицу</h1>
        </div>
        <p className="text-indigo-100">
          Формирование оптимального портфеля на основе теории современного портфеля
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Параметры оптимизации */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 mb-6">
              <Settings className="w-5 h-5 text-indigo-600" />
              <h2 className="font-semibold text-slate-900">Параметры оптимизации</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Минимальный вес актива (%)
                </label>
                <input
                  type="number"
                  value={params.minWeight}
                  onChange={(e) => setParams({ ...params, minWeight: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  placeholder="0"
                  min="0"
                  max="100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Максимальный вес актива (%)
                </label>
                <input
                  type="number"
                  value={params.maxWeight}
                  onChange={(e) => setParams({ ...params, maxWeight: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  placeholder="30"
                  min="0"
                  max="100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Безрисковая ставка (%)
                </label>
                <input
                  type="number"
                  value={params.riskFreeRate}
                  onChange={(e) => setParams({ ...params, riskFreeRate: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  placeholder="4.5"
                  step="0.1"
                />
              </div>

              <button
                onClick={handleOptimize}
                className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 text-white py-3 rounded-lg font-medium hover:from-indigo-700 hover:to-blue-700 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
              >
                <Calculator className="w-5 h-5" />
                Оптимизировать портфель
              </button>
            </div>
          </div>

          {/* Метрики оптимальных портфелей */}
          {optimizationRun && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 space-y-4">
              <h3 className="font-semibold text-slate-900 mb-4">Оптимальные портфели</h3>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-slate-700">Макс. коэфф. Шарпа</span>
                </div>
                <div className="text-2xl font-semibold text-blue-600">0.97</div>
                <div className="text-xs text-slate-600 mt-1">Доходность: 22% | Риск: 18%</div>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-slate-700">Мин. волатильность</span>
                </div>
                <div className="text-2xl font-semibold text-green-600">12%</div>
                <div className="text-xs text-slate-600 mt-1">Доходность: 14% | Шарп: 0.68</div>
              </div>
            </div>
          )}
        </div>

        {/* Графики и результаты */}
        <div className="lg:col-span-2 space-y-6">
          {/* Эффективная граница */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <h3 className="font-semibold text-slate-900 mb-4">Эффективная граница Марковица</h3>
            <ResponsiveContainer width="100%" height={400}>
              <ScatterChart margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis 
                  type="number" 
                  dataKey="risk" 
                  name="Риск" 
                  unit="%" 
                  label={{ value: 'Волатильность (%)', position: 'insideBottom', offset: -10 }}
                  stroke="#64748b"
                />
                <YAxis 
                  type="number" 
                  dataKey="return" 
                  name="Доходность" 
                  unit="%" 
                  label={{ value: 'Ожидаемая доходность (%)', angle: -90, position: 'insideLeft' }}
                  stroke="#64748b"
                />
                <ZAxis range={[100, 100]} />
                <Tooltip 
                  cursor={{ strokeDasharray: '3 3' }}
                  content={({ payload }) => {
                    if (payload && payload.length) {
                      return (
                        <div className="bg-white p-3 rounded-lg shadow-lg border border-slate-200">
                          <p className="text-sm font-medium text-slate-700">
                            Риск: {payload[0].value}%
                          </p>
                          <p className="text-sm font-medium text-slate-700">
                            Доходность: {payload[1].value.toFixed(2)}%
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                
                {/* Эффективная граница */}
                <Scatter 
                  name="Эффективная граница" 
                  data={efficientFrontier} 
                  fill="#6366f1" 
                  line={{ stroke: '#6366f1', strokeWidth: 2 }}
                  shape="circle"
                />
                
                {/* Оптимальные портфели */}
                {optimizationRun && (
                  <>
                    <Scatter 
                      name="Макс. Шарпа" 
                      data={[optimalPortfolios[0]]} 
                      fill="#3b82f6" 
                      shape="star"
                    />
                    <Scatter 
                      name="Мин. Волат." 
                      data={[optimalPortfolios[1]]} 
                      fill="#10b981" 
                      shape="diamond"
                    />
                  </>
                )}
                
                <Legend />
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          {/* Веса портфелей */}
          {optimizationRun && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Портфель с максимальным коэффициентом Шарпа */}
              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                  <h3 className="font-semibold text-slate-900">
                    Портфель с макс. коэфф. Шарпа
                  </h3>
                </div>
                
                <ResponsiveContainer width="100%" height={250}>
                  <RechartsPie>
                    <Pie
                      data={maxSharpeWeights}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {maxSharpeWeights.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </RechartsPie>
                </ResponsiveContainer>

                <div className="mt-4 space-y-2">
                  {maxSharpeWeights.map((asset) => (
                    <div key={asset.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: asset.color }}
                        />
                        <span className="text-slate-700">{asset.name}</span>
                      </div>
                      <span className="font-medium text-slate-900">{asset.value}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Портфель с минимальной волатильностью */}
              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                <div className="flex items-center gap-2 mb-4">
                  <Shield className="w-5 h-5 text-green-600" />
                  <h3 className="font-semibold text-slate-900">
                    Портфель с мин. волатильностью
                  </h3>
                </div>
                
                <ResponsiveContainer width="100%" height={250}>
                  <RechartsPie>
                    <Pie
                      data={minVolWeights}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {minVolWeights.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </RechartsPie>
                </ResponsiveContainer>

                <div className="mt-4 space-y-2">
                  {minVolWeights.map((asset) => (
                    <div key={asset.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: asset.color }}
                        />
                        <span className="text-slate-700">{asset.name}</span>
                      </div>
                      <span className="font-medium text-slate-900">{asset.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
