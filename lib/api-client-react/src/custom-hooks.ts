import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { UseQueryOptions } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";
import type { JobListing, JobListingStatus } from "./generated/api.schemas";

export type JobStatus = JobListingStatus;

export type Resume = {
  id: number;
  userId: string;
  name: string;
  content: string;
  createdAt: string;
};

export type CreateResumeInput = {
  name: string;
  content: string;
};

export type UpdateResumeInput = {
  name?: string;
  content?: string;
};

export type GlobalSettings = { defaultMinKeywordFrequency: number };
export type UserFrequencySettings = { minKeywordFrequency: number | null };

export const getGlobalSettingsQueryKey = () => ["/api/settings"] as const;

export const useGetGlobalSettings = () =>
  useQuery<GlobalSettings>({
    queryKey: getGlobalSettingsQueryKey(),
    queryFn: ({ signal }) => customFetch<GlobalSettings>("/api/settings", { method: "GET", signal }),
  });

export const useUpdateGlobalSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { defaultMinKeywordFrequency: number }) =>
      customFetch<GlobalSettings>("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData<GlobalSettings>(getGlobalSettingsQueryKey(), updated);
    },
  });
};

export const getUserFrequencyQueryKey = () => ["/api/user/settings"] as const;

export const useGetUserFrequency = () =>
  useQuery<UserFrequencySettings>({
    queryKey: getUserFrequencyQueryKey(),
    queryFn: ({ signal }) =>
      customFetch<UserFrequencySettings>("/api/user/settings", { method: "GET", signal }),
  });

export const useUpdateUserFrequency = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { minKeywordFrequency: number | null }) =>
      customFetch<UserFrequencySettings>("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData<UserFrequencySettings>(getUserFrequencyQueryKey(), updated);
    },
  });
};

export const getListJobsQueryKey = () => ["/api/jobs"] as const;

export const useListJobs = <TData = JobListing[], TError = unknown>(options?: {
  query?: UseQueryOptions<JobListing[], TError, TData>;
}) => {
  const { query: queryOptions } = options ?? {};
  return useQuery<JobListing[], TError, TData>({
    queryKey: getListJobsQueryKey(),
    queryFn: ({ signal }) =>
      customFetch<JobListing[]>("/api/jobs", { method: "GET", signal }),
    ...queryOptions,
  });
};

export const useUpdateJobStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: JobStatus }) =>
      customFetch<JobListing>(`/api/jobs/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData<JobListing[]>(getListJobsQueryKey(), (old) =>
        old ? old.map((j) => (j.id === updated.id ? updated : j)) : old
      );
    },
  });
};

export const useBatchUpdateJobStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, status }: { ids: number[]; status: JobStatus }) =>
      customFetch<{ updated: number }>("/api/jobs/batch-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, status }),
      }),
    onSuccess: (_result, { ids, status }) => {
      queryClient.setQueryData<JobListing[]>(getListJobsQueryKey(), (old) =>
        old ? old.map((j) => (ids.includes(j.id) ? { ...j, status } : j)) : old
      );
    },
  });
};

export const getListResumesQueryKey = () => ["/api/resumes"] as const;

export const useListResumes = <TData = Resume[], TError = unknown>(options?: {
  query?: UseQueryOptions<Resume[], TError, TData>;
}) => {
  const { query: queryOptions } = options ?? {};
  return useQuery<Resume[], TError, TData>({
    queryKey: getListResumesQueryKey(),
    queryFn: ({ signal }) =>
      customFetch<Resume[]>("/api/resumes", { method: "GET", signal }),
    ...queryOptions,
  });
};

export const useCreateResume = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateResumeInput) =>
      customFetch<Resume>("/api/resumes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: (created) => {
      queryClient.setQueryData<Resume[]>(getListResumesQueryKey(), (old) =>
        old ? [...old, created] : [created]
      );
    },
  });
};

export const useUpdateResume = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: number } & UpdateResumeInput) =>
      customFetch<Resume>(`/api/resumes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData<Resume[]>(getListResumesQueryKey(), (old) =>
        old ? old.map((r) => (r.id === updated.id ? updated : r)) : old
      );
    },
  });
};

export const useDeleteResume = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      customFetch<void>(`/api/resumes/${id}`, { method: "DELETE" }),
    onSuccess: (_result, id) => {
      queryClient.setQueryData<Resume[]>(getListResumesQueryKey(), (old) =>
        old ? old.filter((r) => r.id !== id) : old
      );
    },
  });
};
