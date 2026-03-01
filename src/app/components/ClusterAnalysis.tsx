import { useState } from "react";
import { Network, Play, Settings, Upload } from "lucide-react";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { EmbeddedMarkowitz } from "./EmbeddedMarkowitz";

export function ClusterAnalysis() {
  const [params, setParams] = useState({
    apiToken: "",
    dataLoaded: false,
    numClusters: "4",
    algorithm: "kmeans",
  });

  const [modelRun, setModelRun] = useState(false);

  // Генерация кластерных данных по P/E и g
  const generateClusterData = () => {
    const clusters = [
      { center: [12, 20], color: "#3b82f6", label: "Кластер 1: Высокий рост" },
      { center: [8, 15], color: "#10b981", label: "Кластер 2: Растущие" },
      { center: [15, 8], color: "#f59e0b", label: "Кластер 3: Переоцененные" },
      { center: [6, 5], color: "#ef4444", label: "Кластер 4: Value" },
    ];

    const data: any[] = [];
    clusters.forEach((cluster, clusterIdx) => {
      for (let i = 0; i < 15; i++) {
        data.push({
          pe: cluster.center[0] + (Math.random() - 0.5) * 4,
          g: cluster.center[1] + (Math.random() - 0.5) * 6,
          cluster: clusterIdx,
          color: cluster.color,
          label: cluster.label,
        });
      }
    });

    return data;
  };

  const clusterData = generateClusterData();

  // Группировка по кластерам для отображения
  const clusterGroups = [
    { name: "Кластер 1", count: 15, avgPE: 12.1, avgG: 19.8, color: "#3b82f6", description: "Высокий рост" },
    { name: "Кластер 2", count: 15, avgPE: 8.2, avgG: 15.2, color: "#10b981", description: "Растущие" },
    { name: "Кластер 3", count: 15, avgPE: 14.8, avgG: 7.9, color: "#f59e0b", description: "Переоцененные" },
    { name: "Кластер 4", count: 15, avgPE: 6.1, avgG: 5.3, color: "#ef4444", description: "Value" },
  ];

  const handleLoadData = () => {
    setParams({ ...params, dataLoaded: true });
  };

  const handleRunModel = () => {
    setModelRun(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          <Network className="w-8 h-8" />
          <h1 className="text-3xl font-bold">Кластерный анализ</h1>
        </div>
        <p className="text-purple-100">
          Группировка компаний по мультипликатору P/E и темпам роста g
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Настройки модели */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 mb-6">
              <Settings className="w-5 h-5 text-purple-600" />
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
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none text-sm"
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
                  Алгоритм
                </label>
                <select
                  value={params.algorithm}
                  onChange={(e) => setParams({ ...params, algorithm: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                  disabled={!params.dataLoaded}
                >
                  <option value="kmeans">K-Means</option>
                  <option value="dbscan">DBSCAN</option>
                  <option value="hierarchical">Иерархическая</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Количество кластеров
                </label>
                <input
                  type="number"
                  value={params.numClusters}
                  onChange={(e) => setParams({ ...params, numClusters: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                  min="2"
                  max="10"
                  disabled={!params.dataLoaded}
                />
              </div>

              <button
                onClick={handleRunModel}
                disabled={!params.dataLoaded}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-lg font-medium hover:from-purple-700 hover:to-pink-700 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Play className="w-5 h-5" />
                Запустить анализ
              </button>
            </div>
          </div>
        </div>

        {/* Результаты */}
        <div className="lg:col-span-3 space-y-6">
          {/* Статистика кластеров */}
          {modelRun && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {clusterGroups.map((cluster) => (
                <div
                  key={cluster.name}
                  className="bg-white rounded-xl p-5 shadow-sm border border-slate-200"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: cluster.color }}
                    />
                    <div>
                      <h3 className="font-semibold text-slate-900">{cluster.name}</h3>
                      <p className="text-xs text-slate-600">{cluster.description}</p>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Компаний:</span>
                      <span className="font-medium text-slate-900">{cluster.count}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Ср. P/E:</span>
                      <span className="font-medium text-blue-600">{cluster.avgPE.toFixed(1)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Ср. рост g:</span>
                      <span className="font-medium text-green-600">{cluster.avgG.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* График кластеров */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <h3 className="font-semibold text-slate-900 mb-4">Визуализация кластеров: P/E vs Темпы роста g</h3>
            <ResponsiveContainer width="100%" height={500}>
              <ScatterChart margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  type="number"
                  dataKey="pe"
                  name="P/E"
                  label={{ value: 'P/E', position: 'insideBottom', offset: -10 }}
                  stroke="#64748b"
                />
                <YAxis
                  type="number"
                  dataKey="g"
                  name="Рост"
                  unit="%"
                  label={{ value: 'Темпы роста g (%)', angle: -90, position: 'insideLeft' }}
                  stroke="#64748b"
                />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  content={({ payload }) => {
                    if (payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white p-3 rounded-lg shadow-lg border border-slate-200">
                          <p className="text-sm font-medium text-slate-700 mb-1">
                            {data.label}
                          </p>
                          <p className="text-sm text-slate-600">
                            P/E: {data.pe.toFixed(2)}
                          </p>
                          <p className="text-sm text-slate-600">
                            Рост: {data.g.toFixed(2)}%
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                {modelRun && (
                  <>
                    <Scatter name="Кластер 1" data={clusterData.filter((d) => d.cluster === 0)}>
                      {clusterData.filter((d) => d.cluster === 0).map((entry, index) => (
                        <Cell key={`cell-0-${index}`} fill={entry.color} />
                      ))}
                    </Scatter>
                    <Scatter name="Кластер 2" data={clusterData.filter((d) => d.cluster === 1)}>
                      {clusterData.filter((d) => d.cluster === 1).map((entry, index) => (
                        <Cell key={`cell-1-${index}`} fill={entry.color} />
                      ))}
                    </Scatter>
                    <Scatter name="Кластер 3" data={clusterData.filter((d) => d.cluster === 2)}>
                      {clusterData.filter((d) => d.cluster === 2).map((entry, index) => (
                        <Cell key={`cell-2-${index}`} fill={entry.color} />
                      ))}
                    </Scatter>
                    <Scatter name="Кластер 4" data={clusterData.filter((d) => d.cluster === 3)}>
                      {clusterData.filter((d) => d.cluster === 3).map((entry, index) => (
                        <Cell key={`cell-3-${index}`} fill={entry.color} />
                      ))}
                    </Scatter>
                    <Legend />
                  </>
                )}
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          {/* Характеристики кластеров */}
          {modelRun && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-4">Интерпретация кластеров</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-3 h-3 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium text-slate-900">Кластер 1: Высокий рост</h4>
                    <p className="text-sm text-slate-600 mt-1">
                      Компании с умеренным P/E и высокими темпами роста. Это растущие компании с хорошим 
                      потенциалом, которые еще не сильно переоценены рынком. PEG-ratio благоприятный.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-3 h-3 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium text-slate-900">Кластер 2: Растущие</h4>
                    <p className="text-sm text-slate-600 mt-1">
                      Сбалансированное соотношение P/E и роста. Компании с устойчивым развитием и 
                      справедливой оценкой. Подходят для основы портфеля.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-3 h-3 rounded-full bg-orange-500 mt-1.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium text-slate-900">Кластер 3: Переоцененные</h4>
                    <p className="text-sm text-slate-600 mt-1">
                      Высокий P/E при низких темпах роста. Потенциально переоцененные активы, требующие 
                      тщательного фундаментального анализа перед инвестированием.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-3 h-3 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium text-slate-900">Кластер 4: Value</h4>
                    <p className="text-sm text-slate-600 mt-1">
                      Низкий P/E и умеренные темпы роста. Классические value-акции, которые могут быть 
                      недооценены рынком. Подходят для стоимостного инвестирования.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <EmbeddedMarkowitz accentClassName="text-purple-600" />
        </div>
      </div>
    </div>
  );
}
