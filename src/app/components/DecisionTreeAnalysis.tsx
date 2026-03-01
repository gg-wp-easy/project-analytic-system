import { useState } from "react";
import { GitBranch, Play, Settings, ChevronRight, Upload } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { EmbeddedMarkowitz } from "./EmbeddedMarkowitz";

export function DecisionTreeAnalysis() {
  const [params, setParams] = useState({
    apiToken: "",
    dataLoaded: false,
    maxDepth: "5",
    minSamples: "20",
    criterion: "gini",
    target: "investment_decision",
  });

  const [modelRun, setModelRun] = useState(false);

  const metrics = {
    accuracy: 0.847,
    precision: 0.829,
    recall: 0.856,
    f1Score: 0.842,
  };

  // Важность признаков: P/E, P/B, ROE, g
  const featureImportance = [
    { feature: "ROE", importance: 32 },
    { feature: "P/E", importance: 28 },
    { feature: "g (рост)", importance: 24 },
    { feature: "P/B", importance: 16 },
  ];

  // Confusion Matrix данные
  const confusionMatrix = {
    truePositive: 156,
    falsePositive: 28,
    trueNegative: 142,
    falseNegative: 24,
  };

  const handleLoadData = () => {
    setParams({ ...params, dataLoaded: true });
  };

  const handleRunModel = () => {
    setModelRun(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          <GitBranch className="w-8 h-8" />
          <h1 className="text-3xl font-bold">Анализ деревьев решений</h1>
        </div>
        <p className="text-green-100">
          Классификация инвестиционных решений на основе P/E, P/B, ROE и темпов роста g
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Настройки модели */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 mb-6">
              <Settings className="w-5 h-5 text-green-600" />
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
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-sm"
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
                  Цель классификации
                </label>
                <select
                  value={params.target}
                  onChange={(e) => setParams({ ...params, target: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                  disabled={!params.dataLoaded}
                >
                  <option value="investment_decision">Решение (Покупка/Продажа)</option>
                  <option value="risk_level">Уровень риска</option>
                  <option value="growth_potential">Потенциал роста</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Критерий разделения
                </label>
                <select
                  value={params.criterion}
                  onChange={(e) => setParams({ ...params, criterion: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                  disabled={!params.dataLoaded}
                >
                  <option value="gini">Gini</option>
                  <option value="entropy">Entropy</option>
                  <option value="log_loss">Log Loss</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Максимальная глубина
                </label>
                <input
                  type="number"
                  value={params.maxDepth}
                  onChange={(e) => setParams({ ...params, maxDepth: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                  min="1"
                  max="20"
                  disabled={!params.dataLoaded}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Мин. выборка для разделения
                </label>
                <input
                  type="number"
                  value={params.minSamples}
                  onChange={(e) => setParams({ ...params, minSamples: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                  min="2"
                  max="100"
                  disabled={!params.dataLoaded}
                />
              </div>

              <button
                onClick={handleRunModel}
                disabled={!params.dataLoaded}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-3 rounded-lg font-medium hover:from-green-700 hover:to-emerald-700 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Play className="w-5 h-5" />
                Обучить модель
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
                <div className="text-sm text-slate-600 mb-1">Accuracy</div>
                <div className="text-2xl font-semibold text-green-600">
                  {(metrics.accuracy * 100).toFixed(1)}%
                </div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                <div className="text-sm text-slate-600 mb-1">Precision</div>
                <div className="text-2xl font-semibold text-slate-900">
                  {(metrics.precision * 100).toFixed(1)}%
                </div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                <div className="text-sm text-slate-600 mb-1">Recall</div>
                <div className="text-2xl font-semibold text-slate-900">
                  {(metrics.recall * 100).toFixed(1)}%
                </div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                <div className="text-sm text-slate-600 mb-1">F1 Score</div>
                <div className="text-2xl font-semibold text-slate-900">
                  {(metrics.f1Score * 100).toFixed(1)}%
                </div>
              </div>
            </div>
          )}

          {/* Важность признаков */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <h3 className="font-semibold text-slate-900 mb-4">Важность признаков</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart 
                data={featureImportance} 
                layout="vertical"
                margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" stroke="#64748b" unit="%" />
                <YAxis type="category" dataKey="feature" stroke="#64748b" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px'
                  }}
                />
                <Bar dataKey="importance" fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-slate-700">
                <strong>ROE (32%)</strong> - наиболее важный фактор для классификации. 
                Высокая рентабельность собственного капитала сильно влияет на инвестиционное решение.
              </p>
            </div>
          </div>

          {/* Визуализация дерева решений */}
          {modelRun && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-4">Структура дерева решений</h3>
              <div className="space-y-4">
                {/* Root Node */}
                <div className="flex items-start gap-3">
                  <div className="bg-green-100 border-2 border-green-500 rounded-lg p-4 flex-1">
                    <div className="text-sm font-medium text-slate-900">Корень: ROE &gt; 15%</div>
                    <div className="text-xs text-slate-600 mt-1">samples = 247 | gini = 0.498</div>
                  </div>
                </div>

                {/* Level 1 */}
                <div className="ml-8 space-y-3">
                  <div className="flex items-center gap-2">
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                    <div className="bg-blue-50 border border-blue-300 rounded-lg p-3 flex-1">
                      <div className="text-sm font-medium text-slate-900">P/E &lt; 20</div>
                      <div className="text-xs text-slate-600 mt-1">samples = 132 | gini = 0.445</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                    <div className="bg-blue-50 border border-blue-300 rounded-lg p-3 flex-1">
                      <div className="text-sm font-medium text-slate-900">g &gt; 10%</div>
                      <div className="text-xs text-slate-600 mt-1">samples = 115 | gini = 0.412</div>
                    </div>
                  </div>
                </div>

                {/* Level 2 */}
                <div className="ml-16 space-y-3">
                  <div className="flex items-center gap-2">
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                    <div className="bg-blue-100 border border-blue-400 rounded-lg p-3 flex-1">
                      <div className="text-sm font-medium text-slate-900">P/B &lt; 3</div>
                      <div className="text-xs text-slate-600 mt-1">samples = 68 | gini = 0.289</div>
                    </div>
                  </div>
                </div>

                {/* Leaves */}
                <div className="ml-24 space-y-3">
                  <div className="flex items-center gap-2">
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                    <div className="bg-emerald-100 border border-emerald-500 rounded-lg p-3 flex-1">
                      <div className="text-sm font-medium text-slate-900">Лист: Покупка 🟢</div>
                      <div className="text-xs text-slate-600 mt-1">
                        samples = 42 | value = [38, 4] | confidence = 90.5%
                      </div>
                      <div className="text-xs text-green-700 mt-1 font-medium">
                        ROE &gt; 15%, P/E &lt; 20, g &gt; 10%, P/B &lt; 3
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                    <div className="bg-red-100 border border-red-500 rounded-lg p-3 flex-1">
                      <div className="text-sm font-medium text-slate-900">Лист: Продажа 🔴</div>
                      <div className="text-xs text-slate-600 mt-1">
                        samples = 26 | value = [4, 22] | confidence = 84.6%
                      </div>
                      <div className="text-xs text-red-700 mt-1 font-medium">
                        Не соответствует критериям покупки
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Confusion Matrix */}
          {modelRun && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-4">Матрица ошибок</h3>
              <div className="max-w-md mx-auto">
                <div className="grid grid-cols-3 gap-2">
                  <div></div>
                  <div className="text-center text-sm font-medium text-slate-700">Прогноз: Покупка</div>
                  <div className="text-center text-sm font-medium text-slate-700">Прогноз: Продажа</div>

                  <div className="text-sm font-medium text-slate-700 flex items-center">Факт: Покупка</div>
                  <div className="bg-green-100 border border-green-300 rounded-lg p-4 text-center">
                    <div className="text-2xl font-semibold text-green-700">
                      {confusionMatrix.truePositive}
                    </div>
                    <div className="text-xs text-slate-600 mt-1">True Positive</div>
                  </div>
                  <div className="bg-red-100 border border-red-300 rounded-lg p-4 text-center">
                    <div className="text-2xl font-semibold text-red-700">
                      {confusionMatrix.falseNegative}
                    </div>
                    <div className="text-xs text-slate-600 mt-1">False Negative</div>
                  </div>

                  <div className="text-sm font-medium text-slate-700 flex items-center">Факт: Продажа</div>
                  <div className="bg-red-100 border border-red-300 rounded-lg p-4 text-center">
                    <div className="text-2xl font-semibold text-red-700">
                      {confusionMatrix.falsePositive}
                    </div>
                    <div className="text-xs text-slate-600 mt-1">False Positive</div>
                  </div>
                  <div className="bg-green-100 border border-green-300 rounded-lg p-4 text-center">
                    <div className="text-2xl font-semibold text-green-700">
                      {confusionMatrix.trueNegative}
                    </div>
                    <div className="text-xs text-slate-600 mt-1">True Negative</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <EmbeddedMarkowitz accentClassName="text-green-600" />
        </div>
      </div>
    </div>
  );
}
