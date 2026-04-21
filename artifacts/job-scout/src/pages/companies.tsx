import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building2, Plus, Trash2, Link as LinkIcon, Loader2, Pencil } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { 
  useListCompanies, 
  useCreateCompany, 
  useDeleteCompany,
  getListCompaniesQueryKey
} from "@workspace/api-client-react";
import type { Company } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useIsAdmin } from "@/hooks/use-is-admin";

const companySchema = z.object({
  name: z.string().min(2, "Company name is required"),
  careersUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
});

type CompanyFormValues = z.infer<typeof companySchema>;

async function updateCompany(id: number, data: { name: string; careersUrl: string | null }): Promise<Company> {
  const resp = await fetch(`/api/companies/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!resp.ok) throw new Error("Failed to update company");
  return resp.json();
}

type ModalMode = "add" | "edit";

export default function CompaniesPage() {
  const [modalMode, setModalMode] = useState<ModalMode>("add");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const { isAdmin } = useIsAdmin();

  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: companies, isLoading } = useListCompanies();
  const createCompany = useCreateCompany();
  const deleteCompany = useDeleteCompany();

  const form = useForm<CompanyFormValues>({
    resolver: zodResolver(companySchema),
    defaultValues: { name: "", careersUrl: "" },
  });

  const handleOpenAdd = () => {
    form.reset({ name: "", careersUrl: "" });
    setEditingCompany(null);
    setModalMode("add");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (company: Company) => {
    form.reset({ name: company.name, careersUrl: company.careersUrl ?? "" });
    setEditingCompany(company);
    setModalMode("edit");
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingCompany(null);
    form.reset();
  };

  const onSubmit = async (data: CompanyFormValues) => {
    if (modalMode === "add") {
      createCompany.mutate(
        { data: { name: data.name, careersUrl: data.careersUrl || null } },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListCompaniesQueryKey() });
            toast({ title: "Company added" });
            handleCloseModal();
          },
          onError: () => {
            toast({ title: "Failed to add company", variant: "destructive" });
          },
        }
      );
    } else if (editingCompany) {
      setIsSaving(true);
      try {
        await updateCompany(editingCompany.id, {
          name: data.name,
          careersUrl: data.careersUrl || null,
        });
        queryClient.invalidateQueries({ queryKey: getListCompaniesQueryKey() });
        toast({ title: "Company updated" });
        handleCloseModal();
      } catch {
        toast({ title: "Failed to update company", variant: "destructive" });
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleDelete = (id: number, name: string) => {
    if (confirm(`Are you sure you want to remove ${name}?`)) {
      deleteCompany.mutate(
        { id },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListCompaniesQueryKey() });
            toast({ title: "Company removed" });
          },
        }
      );
    }
  };

  const isPending = createCompany.isPending || isSaving;

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold mb-1" style={{ color: "#4d7435" }}>Target Companies</h2>
          <p className="text-sm" style={{ color: "#9a8060" }}>Your roster of dream companies to focus your search efforts.</p>
        </div>
        {isAdmin && (
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors"
            style={{ background: "#4d7435", color: "white" }}
          >
            <Plus className="w-4 h-4" />
            Add Company
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white rounded-2xl h-24 border border-border/50 animate-pulse" />
          ))}
        </div>
      ) : companies && companies.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {[...companies].sort((a, b) => a.name.localeCompare(b.name)).map((company) => (
              <motion.div
                key={company.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                layout
                className="group bg-card p-5 rounded-2xl border border-border shadow-sm hover:shadow-md hover:border-primary/20 transition-all flex items-center justify-between"
              >
                <div className="flex items-center gap-4 overflow-hidden">
                  <div className="w-12 h-12 rounded-xl bg-card-foreground/5 flex items-center justify-center shrink-0 border border-border">
                    <Building2 className="w-6 h-6 text-card-foreground/40" />
                  </div>
                  <div className="overflow-hidden">
                    <h3 className="font-display font-semibold text-card-foreground truncate">{company.name}</h3>
                    {company.careersUrl && (
                      <a
                        href={company.careersUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-1 mt-0.5 truncate"
                      >
                        <LinkIcon className="w-3 h-3 shrink-0" />
                        <span className="truncate">{new URL(company.careersUrl).hostname}</span>
                      </a>
                    )}
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-1 ml-2 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleOpenEdit(company)}
                      className="p-2 text-card-foreground/30 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                      title="Edit company"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(company.id, company.name)}
                      className="p-2 text-card-foreground/30 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                      title="Remove company"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="bg-card border-2 border-border border-dashed rounded-3xl p-12 text-center flex flex-col items-center">
          <div className="w-20 h-20 bg-primary/5 rounded-full flex items-center justify-center mb-4 text-5xl">
            🙈
          </div>
          <h3 className="text-xl font-display font-semibold text-card-foreground mb-2">Build your target list 🐒</h3>
          <p className="text-card-foreground/60 max-w-sm mx-auto mb-6">
            Keep track of the companies you'd love to work for. We'll use this list to filter your searches.
          </p>
          {isAdmin && (
            <button
              onClick={handleOpenAdd}
              className="px-6 py-2.5 rounded-lg font-semibold bg-card-foreground/10 text-card-foreground hover:bg-card-foreground/15 transition-colors"
            >
              Add your first company
            </button>
          )}
        </div>
      )}

      {/* Add / Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={handleCloseModal}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 sm:p-8"
            >
              <h2 className="text-2xl font-display font-bold text-card-foreground mb-6">
                {modalMode === "add" ? "Add Target Company" : "Edit Company"}
              </h2>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-card-foreground mb-1.5">Company Name</label>
                  <input
                    {...form.register("name")}
                    placeholder="e.g. Stripe"
                    className={cn(
                      "w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-card-foreground placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all",
                      form.formState.errors.name && "border-destructive focus:border-destructive focus:ring-destructive/20"
                    )}
                  />
                  {form.formState.errors.name && (
                    <p className="text-sm text-destructive mt-1.5 font-medium">{form.formState.errors.name.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-card-foreground mb-1.5">Careers Page URL</label>
                  <input
                    {...form.register("careersUrl")}
                    placeholder="https://acme.com/careers"
                    className={cn(
                      "w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-card-foreground placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all",
                      form.formState.errors.careersUrl && "border-destructive focus:border-destructive focus:ring-destructive/20"
                    )}
                  />
                  {form.formState.errors.careersUrl && (
                    <p className="text-sm text-destructive mt-1.5 font-medium">{form.formState.errors.careersUrl.message}</p>
                  )}
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="flex-1 px-4 py-3 rounded-xl font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="flex-1 px-4 py-3 rounded-xl font-semibold text-white bg-primary shadow-md shadow-primary/20 hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                  >
                    {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                    {modalMode === "add" ? "Save Company" : "Save Changes"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
