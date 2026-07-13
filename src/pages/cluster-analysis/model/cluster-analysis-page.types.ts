export type SelectionMode = "all" | "manual";
export type ClusterAlgorithm = "kmeans" | "agglomerative" | "dbscan";
export type DistanceMetric = "euclidean" | "manhattan" | "cosine";
export type ScalingMethod = "standard" | "minmax" | "robust" | "none";
export type ClusterTuningMetric = "silhouette" | "davies_bouldin" | "calinski_harabasz";
export type TuningBudget = "fast" | "balanced" | "quality";

export type ClusterAnalysisSettings = {
  algorithm: ClusterAlgorithm;
  clustersCount: number;
  distanceMetric: DistanceMetric;
  scalingMethod: ScalingMethod;
  randomState: number;
  includeOutliers: boolean;
  autoTune: boolean;
  tuningMetric: ClusterTuningMetric;
  tuningBudget: TuningBudget;
  features: string[];
};

export type ClusterFeatureOption = {
  key: string;
  labelRu: string;
  labelEn: string;
};
