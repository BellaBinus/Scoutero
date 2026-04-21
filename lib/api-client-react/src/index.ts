export * from "./generated/api";
export * from "./generated/api.schemas";
// These custom hooks shadow the generated versions (they include optimistic updates)
export {
  getListJobsQueryKey,
  useListJobs,
  useUpdateJobStatus,
  useBatchUpdateJobStatus,
  getListResumesQueryKey,
  useListResumes,
  useCreateResume,
  useUpdateResume,
  useDeleteResume,
  useGetGlobalSettings,
  useUpdateGlobalSettings,
  useGetUserFrequency,
  useUpdateUserFrequency,
  type GlobalSettings,
  type UserFrequencySettings,
} from "./custom-hooks";
