import { useState } from "react";
import { Layers, Play, Settings } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";
import { EmbeddedMarkowitz } from "./EmbeddedMarkowitz";
import { useFundamentals } from "../../entities/fundamentals";
import { useAppSettings } from "../context/AppSettingsContext";

const modelComparison = [
  { model: "Cluster", score: 0.74 },
  { model: "Tree", score: 0.81 },
  { model: "Neural", score: 0.86 },
  { model: "Hybrid", score: 0.91 },
];

export function HybridAnalysis() {
  const { hasData, cache } = useFundamentals();
  const { t } = useAppSettings();
  const [run, setRun] = useState(false);
  const [weights, setWeights] = useState({
    clusterWeight: "30",
    treeWeight: "30",
    neuralWeight: "40",
  });

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-cyan-700 to-blue-700 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          <Layers className="w-8 h-8" />
          <h1 className="text-3xl font-bold">{t("hybrid.title")}</h1>
        </div>
        <p className="text-cyan-100">
          {t("hybrid.description")}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-cyan-700" />
              <h2 className="font-semibold text-slate-900 dark:text-slate-100">{t("hybrid.paramsTitle")}</h2>
            </div>
            <label className="block text-sm text-slate-700 dark:text-slate-300">
              Вес Cluster (%)
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2"
                value={weights.clusterWeight}
                onChange={(e) => setWeights((v) => ({ ...v, clusterWeight: e.target.value }))}
              />
            </label>
            <label className="block text-sm text-slate-700 dark:text-slate-300">
              Вес Tree (%)
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2"
                value={weights.treeWeight}
                onChange={(e) => setWeights((v) => ({ ...v, treeWeight: e.target.value }))}
              />
            </label>
            <label className="block text-sm text-slate-700 dark:text-slate-300">
              Вес Neural (%)
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2"
                value={weights.neuralWeight}
                onChange={(e) => setWeights((v) => ({ ...v, neuralWeight: e.target.value }))}
              />
            </label>
            <button
              type="button"
              onClick={() => setRun(true)}
              disabled={!hasData}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-cyan-700 to-blue-700 px-4 py-2 text-white font-medium disabled:opacity-50"
            >
              <Play className="w-4 h-4" />
              {t("hybrid.run")}
            </button>
            {!hasData && (
              <p className="text-xs text-amber-700 dark:text-amber-300">
                {t("hybrid.needFundamentals")}
              </p>
            )}
          </div>
        </div>

        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">{t("hybrid.compareTitle")}</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={modelComparison}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="model" stroke="#64748b" />
                  <YAxis stroke="#64748b" domain={[0, 1]} />
                  <Tooltip />
                  <Bar dataKey="score" fill="#0891b2" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {run && (
            <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-3">{t("hybrid.resultTitle")}</h3>
              <p className="text-sm text-slate-700 dark:text-slate-300">
                {t("hybrid.resultText")} ({cache.shares.length}): Cluster {weights.clusterWeight}%, Tree{" "}
                {weights.treeWeight}%, Neural {weights.neuralWeight}%.
              </p>
            </div>
          )}

          <EmbeddedMarkowitz accentClassName="text-cyan-700" />
        </div>
      </div>
    </div>
  );
}

