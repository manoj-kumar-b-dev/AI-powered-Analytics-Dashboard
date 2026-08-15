import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  uploadDatasetApi,
  listDatasetsApi,
  getDatasetProfileApi,
  askQuestionApi
} from '../services/datasetApi';

export function useUserDatasets() {
  return useQuery({
    queryKey: ['datasets'],
    queryFn: listDatasetsApi,
    select: (data) => data?.data || []
  });
}

export function useDatasetProfile(datasetId) {
  return useQuery({
    queryKey: ['datasetProfile', datasetId],
    queryFn: () => getDatasetProfileApi(datasetId),
    enabled: Boolean(datasetId),
    select: (data) => data?.data || null
  });
}

export function useUploadDataset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file) => uploadDatasetApi(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['datasets'] });
    }
  });
}

export function useAskQuestion(datasetId) {
  return useMutation({
    mutationFn: (payload) => {
      if (typeof payload === 'object' && payload.question) {
        return askQuestionApi(datasetId, payload.question, payload.history || []);
      }
      return askQuestionApi(datasetId, payload);
    }
  });
}
