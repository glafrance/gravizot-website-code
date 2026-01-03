import { StoreUsageSnapshot } from "../models/api.models";

export const calculateStoreUsage = (store): StoreUsageSnapshot => {
  const mb = bytesToMB(store.usage_bytes ?? 0);
  const fileCount = store.file_counts?.total ?? 0;
  const totalSizeMB = 1;
  const billableSizeMB = Math.max(0, mb - totalSizeMB);
  const estimatedDailyCost = billableSizeMB * 0.10;

  return {
    fileCount,
    totalSizeMB,
    billableSizeMB,
    estimatedDailyCost
  };
}

export const bytesToMB = (bytes: number) => {
  return bytes / (1024 ** 2);
}
