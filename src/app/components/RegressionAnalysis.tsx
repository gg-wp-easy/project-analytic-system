import { useState } from "react";
import { BarChart3, Play, Settings, Upload } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter } from "recharts";

export function RegressionAnalysis() {
  const [params, setParams] = useState({
    apiToken: "",
    dataLoaded: false,
    regressionType: "pe_g",
  });

  const [modelRun, setModelRun] = useState(false);

  // Данные для P/E от g
  const peData = Array.from({ length: 40 }, (_, i) => ({
    g: 5 + i * 0.8,
    pe: 8 + i * 0.5 + Math.random() * 5,
  }));

  // Данные для PEG от g
  const pegData = Array.from({ length: 40 }, (_, i) => ({
    g: 5 + i * 0.8,
    peg: 1.5 - i * 0.02 + Math.random() * 0.3,
  }));

  // Данные для P/B от ROE
  const pbData = Array.from({ length: 40 }, (_, i) => ({
    roe: 5 + i * 0.6,
    pb: 0.8 + i * 0.08 + Math.random() * 0.4,
  }));

  const metrics = {
    r2: 0.876,
    slope: 0.524,
    intercept: 5.32,
    pValue: 0.0001,
  };

  const handleLoadData = () => {
    setParams({ ...params, dataLoaded: true });
  };

  const handleRunModel = () => {
    setModelRun(true);
  };

  const getRegressionData = () => {
    switch (params.regressionType) {
      case "pe_g":
        return { data: peData, xKey: "g", yKey: "pe", xLabel: "Темп роста g (%)", yLabel: "P/E", title: "P/E от темпов роста" };
      case "peg_g":
        return { data: pegData, xKey: "g", yKey: "peg", xLabel: "Темп роста g (%)", yLabel: "PEG", title: "PEG от темпов роста" };
      case "pb_roe":
        return { data: pbData, xKey: "roe", yKey: "pb", xLabel: "ROE (%)", yLabel: "P/B", title: "P/B от ROE" };
      default:
        return { data: peData, xKey: "g", yKey: "pe", xLabel: "Темп роста g (%)", yLabel: "P/E", title: "P/E от темпов роста" };
    }
  };

  const currentRegression = getRegressionData();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-cyan-600 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          <BarChart3 className="w-8 h-8" />
          <h1 className="text-3xl font-bold">Регрессионный анализ</h1>
        </div>
        <p className="text-blue-100">
          Анализ зависимостей финансовых мультипликаторов
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Настройки модели */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 mb-6">
              <Settings className="w-5 h-5 text-blue-600" />
              <h2 className="font-semibold text-slate-900">Параметры</h2>
            </div>

            <div className="space-y-4">
              {/* T-API Token */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  T-API Token
                </label>
                <input
                  type="password"
                  value={params.apiToken}
                  onChange={(e) => setParams({ ...params, apiToken: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                  placeholder="t.xxxxxxxxxxxxx"
                />
              </div>

              <button
                onClick={handleLoadData}
                className="w-full bg-slate-600 text-white py-2.5 rounded-lg font-medium hover:bg-slate-700 transition-all shadow-sm flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Загрузить данные
              </button>

              {params.dataLoaded && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm text-green-700">✓ Данные загружены</p>
                  <p className="text-xs text-green-600 mt-1">247 компаний</p>
                </div>
              )}

              <div className="border-t border-slate-200 pt-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Тип регрессии
                </label>
                <select
                  value={params.regressionType}
                  onChange={(e) => setParams({ ...params, regressionType: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  disabled={!params.dataLoaded}
                >
                  <option value="pe_g">P/E от темпов роста g</option>
                  <option value="peg_g">PEG от темпов роста g</option>
                  <option value="pb_roe">P/B о�� ROE</option>
                </select>
              </div>

              <button
                onClick={handleRunModel}
                disabled={!params.dataLoaded}
                className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 text-white py-3 rounded-lg font-medium hover:from-blue-700 hover:to-cyan-700 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Play className="w-5 h-5" />
                Построить регрессию
              </button>
            </div>
          </div>
        </div>

        {/* Результаты */}
        <div className="lg:col-span-3 space-y-6">
          {/* Метрики модели */}
          {modelRun && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                <div className="text-sm text-slate-600 mb-1">R² Score</div>
                <div className="text-2xl font-semibold text-blue-600">{metrics.r2}</div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                <div className="text-sm text-slate-600 mb-1">Наклон (β���)</div>
                <div className="text-2xl font-semibold text-slate-900">{metrics.slope}</div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                <div className="text-sm text-slate-600 mb-1">Сдвиг (β₀)</div>
                <div className="text-2xl font-semibold text-slate-900">{metrics.intercept}</div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                <div className="text-sm text-slate-600 mb-1">p-value</div>
                <div className="text-2xl font-semibold text-green-600">{metrics.pValue}</div>
              </div>
            </div>
          )}

          {/* Уравнение регрессии */}
          {modelRun && (
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-6 border border-blue-200">
              <h3 className="font-semibold text-slate-900 mb-3">Уравнение регрессии</h3>
              <div className="bg-white rounded-lg p-4 font-mono text-lg text-center">
                {params.regressionType === "pe_g" && (
                  <span className="text-blue-700">P/E = {metrics.slope} × g + {metrics.intercept}</span>
                )}
                {params.regressionType === "peg_g" && (
                  <span className="text-blue-700">PEG = {metrics.slope} × g + {metrics.intercept}</span>
                )}
                {params.regressionType === "pb_roe" && (
                  <span className="text-blue-700">P/B = {metrics.slope} × ROE + {metrics.intercept}</span>
                )}
              </div>
            </div>
          )}

          {/* График регрессии */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <h3 className="font-semibold text-slate-900 mb-4">{currentRegression.title}</h3>
            <ResponsiveContainer width="100%" height={450}>
              <ScatterChart margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis 
                  type="number" 
                  dataKey={currentRegression.xKey}
                  name={currentRegression.xLabel}
                  label={{ value: currentRegression.xLabel, position: 'insideBottom', offset: -10 }}
                  stroke="#64748b"
                />
                <YAxis 
                  type="number" 
                  dataKey={currentRegression.yKey}
                  name={currentRegression.yLabel}
                  label={{ value: currentRegression.yLabel, angle: -90, position: 'insideLeft' }}
                  stroke="#64748b"
                />
                <Tooltip 
                  cursor={{ strokeDasharray: '3 3' }}
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px'
                  }}
                />
                <Scatter 
                  name="Компании" 
                  data={currentRegression.data} 
                  fill="#3b82f6"
                  opacity={0.6}
                />
                {modelRun && (
                  <Line 
                    type="linear" 
                    dataKey={currentRegression.yKey}
                    stroke="#ef4444" 
                    strokeWidth={3}
                    dot={false}
                    name="Линия регрессии"
                  />
                )}
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          {/* Интерпретация */}
          {modelRun && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-4">Инте��претация результатов</h3>
              <div className="space-y-3 text-sm text-slate-700">
                {params.regressionType === "pe_g" && (
                  <>
                    <p>
                      <strong>Положительная зависимость:</strong> При увеличении темпов роста компании на 1%, 
                      мультипликатор P/E в среднем увеличивается на {metrics.slope} пунктов.
                    </p>
                    <p>
                      <strong>R² = {metrics.r2}:</strong> Модель объясняет {(metrics.r2 * 100).toFixed(1)}% 
                      вариации P/E темпами роста компании.
                    </p>
                  </>
                )}
                {params.regressionType === "peg_g" && (
                  <>
                    <p>
                      <strong>PEG коэффициент:</strong> Показывает соотношение P/E к темпам роста. 
                      Значения близкие к 1 считаются справедливыми.
                    </p>
                    <p>
                      <strong>R² = {metrics.r2}:</strong> Модель демонст��ирует высокую объяснительную способность.
                    </p>
                  </>
                )}
                {params.regressionType === "pb_roe" && (
                  <>
                    <p>
                      <strong>Зависимость P/B от ROE:</strong> Компании с высокой рентабельностью капитала 
                      обычно торгуются с премией к балансовой стоимости.
                    </p>
                    <p>
                      <strong>Наклон {metrics.slope}:</strong> При росте ROE на 1%, P/B увеличивается на {metrics.slope}.
                    </p>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}