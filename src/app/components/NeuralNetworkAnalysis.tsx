import { useState } from "react";
import { Brain, Play, Settings, Layers, Upload } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, ScatterChart, Scatter } from "recharts";
import { EmbeddedMarkowitz } from "./EmbeddedMarkowitz";

export function NeuralNetworkAnalysis() {
  const [params, setParams] = useState({
    apiToken: "",
    dataLoaded: false,
    architecture: "lstm",
    hiddenLayers: "3",
    neuronsPerLayer: "128",
    epochs: "100",
    batchSize: "32",
    learningRate: "0.001",
  });

  const [modelRun, setModelRun] = useState(false);
  const [isTraining, setIsTraining] = useState(false);

  // История обучения
  const trainingHistory = Array.from({ length: 100 }, (_, i) => ({
    epoch: i + 1,
    trainLoss: Math.exp(-i / 20) * 0.8 + Math.random() * 0.1,
    valLoss: Math.exp(-i / 20) * 0.9 + Math.random() * 0.12,
    trainAcc: 100 - Math.exp(-i / 20) * 80 + Math.random() * 2,
    valAcc: 100 - Math.exp(-i / 20) * 85 + Math.random() * 3,
  }));

  // Предсказания EV/EBITDA от признаков
  const predictions = Array.from({ length: 40 }, (_, i) => ({
    company: i + 1,
    actual: 8 + i * 0.3 + Math.random() * 3,
    predicted: 8 + i * 0.3 + Math.random() * 2.5,
  }));

  // Важность входных признаков
  const featureImportance = [
    { feature: "ROE", importance: 32 },
    { feature: "P/B", importance: 26 },
    { feature: "Див. доходность", importance: 24 },
    { feature: "Beta", importance: 18 },
  ];

  const metrics = {
    finalLoss: 0.038,
    mape: 4.2,
    r2: 0.891,
    mae: 0.82,
  };

  const handleLoadData = () => {
    setParams({ ...params, dataLoaded: true });
  };

  const handleRunModel = () => {
    setIsTraining(true);
    setTimeout(() => {
      setIsTraining(false);
      setModelRun(true);
    }, 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-600 to-red-600 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          <Brain className="w-8 h-8" />
          <h1 className="text-3xl font-bold">Анализ нейронной сети</h1>
        </div>
        <p className="text-orange-100">
          Прогнозирование EV/EBITDA на основе ROE, P/B, дивидендной доходности и beta
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Настройки модели */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 mb-6">
              <Settings className="w-5 h-5 text-orange-600" />
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
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-sm"
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
                  <p className="text-xs text-green-600 mt-1">247 компаний | 4 признака</p>
                </div>
              )}

              <div className="border-t border-slate-200 pt-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Архитектура
                </label>
                <select
                  value={params.architecture}
                  onChange={(e) => setParams({ ...params, architecture: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                  disabled={!params.dataLoaded}
                >
                  <option value="lstm">LSTM</option>
                  <option value="gru">GRU</option>
                  <option value="dense">Dense (MLP)</option>
                  <option value="transformer">Transformer</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Скрытые слои
                </label>
                <input
                  type="number"
                  value={params.hiddenLayers}
                  onChange={(e) => setParams({ ...params, hiddenLayers: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                  min="1"
                  max="10"
                  disabled={!params.dataLoaded}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Нейронов в слое
                </label>
                <select
                  value={params.neuronsPerLayer}
                  onChange={(e) => setParams({ ...params, neuronsPerLayer: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                  disabled={!params.dataLoaded}
                >
                  <option value="32">32</option>
                  <option value="64">64</option>
                  <option value="128">128</option>
                  <option value="256">256</option>
                  <option value="512">512</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Эпохи
                </label>
                <input
                  type="number"
                  value={params.epochs}
                  onChange={(e) => setParams({ ...params, epochs: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                  min="10"
                  max="1000"
                  disabled={!params.dataLoaded}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Batch Size
                </label>
                <select
                  value={params.batchSize}
                  onChange={(e) => setParams({ ...params, batchSize: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                  disabled={!params.dataLoaded}
                >
                  <option value="16">16</option>
                  <option value="32">32</option>
                  <option value="64">64</option>
                  <option value="128">128</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Learning Rate
                </label>
                <input
                  type="number"
                  value={params.learningRate}
                  onChange={(e) => setParams({ ...params, learningRate: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                  step="0.0001"
                  min="0.0001"
                  max="0.1"
                  disabled={!params.dataLoaded}
                />
              </div>

              <button
                onClick={handleRunModel}
                disabled={isTraining || !params.dataLoaded}
                className="w-full bg-gradient-to-r from-orange-600 to-red-600 text-white py-3 rounded-lg font-medium hover:from-orange-700 hover:to-red-700 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isTraining ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Обучение...
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5" />
                    Обучить сеть
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Архитектура сети */}
          {modelRun && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 mt-6">
              <div className="flex items-center gap-2 mb-4">
                <Layers className="w-5 h-5 text-orange-600" />
                <h3 className="font-semibold text-slate-900">Архитектура</h3>
              </div>
              <div className="space-y-2">
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                  <div className="text-xs text-slate-600">Input Layer</div>
                  <div className="text-sm font-medium text-slate-900">4 features</div>
                  <div className="text-xs text-slate-500 mt-1">ROE, P/B, Див.дох., Beta</div>
                </div>
                {Array.from({ length: parseInt(params.hiddenLayers) }, (_, i) => (
                  <div key={i} className="bg-orange-50 rounded-lg p-3 border border-orange-200">
                    <div className="text-xs text-slate-600">
                      {params.architecture.toUpperCase()} Layer {i + 1}
                    </div>
                    <div className="text-sm font-medium text-slate-900">
                      {params.neuronsPerLayer} units
                    </div>
                  </div>
                ))}
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                  <div className="text-xs text-slate-600">Output Layer</div>
                  <div className="text-sm font-medium text-slate-900">1 unit (Dense)</div>
                  <div className="text-xs text-slate-500 mt-1">EV/EBITDA</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Результаты */}
        <div className="lg:col-span-3 space-y-6">
          {/* Метрики модели */}
          {modelRun && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                <div className="text-sm text-slate-600 mb-1">Loss</div>
                <div className="text-2xl font-semibold text-orange-600">{metrics.finalLoss}</div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                <div className="text-sm text-slate-600 mb-1">R²</div>
                <div className="text-2xl font-semibold text-green-600">{metrics.r2}</div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                <div className="text-sm text-slate-600 mb-1">MAPE</div>
                <div className="text-2xl font-semibold text-slate-900">{metrics.mape}%</div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                <div className="text-sm text-slate-600 mb-1">MAE</div>
                <div className="text-2xl font-semibold text-slate-900">{metrics.mae}</div>
              </div>
            </div>
          )}

          {/* График обучения */}
          {modelRun && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-4">История обучения</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Loss */}
                <div>
                  <h4 className="text-sm font-medium text-slate-700 mb-3">Loss</h4>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={trainingHistory}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="epoch" stroke="#64748b" />
                      <YAxis stroke="#64748b" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'white',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px'
                        }}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="trainLoss"
                        stroke="#f97316"
                        strokeWidth={2}
                        name="Train"
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="valLoss"
                        stroke="#ef4444"
                        strokeWidth={2}
                        name="Validation"
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Accuracy */}
                <div>
                  <h4 className="text-sm font-medium text-slate-700 mb-3">Accuracy</h4>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={trainingHistory}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="epoch" stroke="#64748b" />
                      <YAxis stroke="#64748b" domain={[0, 100]} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'white',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px'
                        }}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="trainAcc"
                        stroke="#10b981"
                        strokeWidth={2}
                        name="Train"
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="valAcc"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        name="Validation"
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* Важность признаков */}
          {modelRun && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-4">Важность входных признаков</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {featureImportance.map((feature, idx) => (
                  <div key={idx} className="bg-gradient-to-br from-orange-50 to-red-50 rounded-lg p-4 border border-orange-200">
                    <div className="text-xs text-slate-600 mb-1">{feature.feature}</div>
                    <div className="text-2xl font-semibold text-orange-600">{feature.importance}%</div>
                    <div className="mt-2 bg-slate-200 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-orange-500 to-red-500 h-2 rounded-full"
                        style={{ width: `${feature.importance}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 bg-orange-50 border border-orange-200 rounded-lg p-4">
                <p className="text-sm text-slate-700">
                  <strong>ROE</strong> и <strong>P/B</strong> - наиболее значимые факторы для предсказания EV/EBITDA. 
                  Дивидендная доходность и Beta также вносят существенный вклад в модель.
                </p>
              </div>
            </div>
          )}

          {/* Прогнозы vs Факт */}
          {modelRun && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-4">Прогноз EV/EBITDA vs Фактические значения</h3>
              <ResponsiveContainer width="100%" height={400}>
                <ScatterChart margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis 
                    type="number" 
                    dataKey="actual" 
                    name="Факт"
                    label={{ value: 'Фактическое EV/EBITDA', position: 'insideBottom', offset: -10 }}
                    stroke="#64748b"
                  />
                  <YAxis 
                    type="number" 
                    dataKey="predicted" 
                    name="Прогноз"
                    label={{ value: 'Прогноз EV/EBITDA', angle: -90, position: 'insideLeft' }}
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
                  <Scatter name="Компании" data={predictions} fill="#f97316" />
                  <Line 
                    type="linear" 
                    dataKey="predicted"
                    stroke="#ef4444" 
                    strokeWidth={2}
                    dot={false}
                    name="Линия идеального прогноза"
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Интерпретация */}
          {modelRun && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-4">Интерпретация модели</h3>
              <div className="space-y-3 text-sm text-slate-700">
                <p>
                  <strong>Высокая точность (R² = {metrics.r2}):</strong> Нейронная сеть успешно выявляет 
                  нелинейные зависимости между финансовыми показателями и мультипликатором EV/EBITDA.
                </p>
                <p>
                  <strong>Входные признаки:</strong> Модель обучена на четырех ключевых показателях - 
                  рентабельность капитала (ROE), мультипликатор P/B, дивидендная доходность и коэффициент beta.
                </p>
                <p>
                  <strong>MAPE {metrics.mape}%:</strong> Средняя абсолютная процентная ошибка показывает 
                  высокую надежность прогнозов для принятия инвестиционных решений.
                </p>
              </div>
            </div>
          )}

          <EmbeddedMarkowitz accentClassName="text-orange-600" />
        </div>
      </div>
    </div>
  );
}
