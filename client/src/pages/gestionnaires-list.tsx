import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertGestionnaireSchema, type Gestionnaire } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link } from "wouter";
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  Mail,
  Phone,
  MapPin,
  Loader2,
  ArrowLeft,
} from "lucide-react";

const formSchema = insertGestionnaireSchema.extend({
  nom: z.string().min(1, "Le nom est requis"),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
  telephone: z.string().optional(),
  adresse: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

function GestionnaireForm({
  gestionnaire,
  onSuccess,
  onCancel,
}: {
  gestionnaire?: Gestionnaire;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const isEdit = !!gestionnaire;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nom: gestionnaire?.nom ?? "",
      email: gestionnaire?.email ?? "",
      telephone: gestionnaire?.telephone ?? "",
      adresse: gestionnaire?.adresse ?? "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const res = await apiRequest("POST", "/api/gestionnaires", {
        nom: data.nom,
        email: data.email || null,
        telephone: data.telephone || null,
        adresse: data.adresse || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gestionnaires"] });
      toast({ title: "Gestionnaire créé avec succès" });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const res = await apiRequest("PUT", `/api/gestionnaires/${gestionnaire!.id}`, {
        nom: data.nom,
        email: data.email || null,
        telephone: data.telephone || null,
        adresse: data.adresse || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gestionnaires"] });
      toast({ title: "Gestionnaire mis à jour avec succès" });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const onSubmit = (data: FormValues) => {
    if (isEdit) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="nom"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nom *</FormLabel>
              <FormControl>
                <Input placeholder="Cabinet Durand Immobilier" {...field} data-testid="input-gestionnaire-nom" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="contact@exemple.fr"
                  {...field}
                  value={field.value ?? ""}
                  data-testid="input-gestionnaire-email"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="telephone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Téléphone</FormLabel>
              <FormControl>
                <Input
                  type="tel"
                  placeholder="01 23 45 67 89"
                  {...field}
                  value={field.value ?? ""}
                  data-testid="input-gestionnaire-telephone"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="adresse"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Adresse</FormLabel>
              <FormControl>
                <Input
                  placeholder="1 rue de la Paix, 75001 Paris"
                  {...field}
                  value={field.value ?? ""}
                  data-testid="input-gestionnaire-adresse"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel-gestionnaire">
            Annuler
          </Button>
          <Button type="submit" disabled={isPending} data-testid="button-submit-gestionnaire">
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isEdit ? "Mettre à jour" : "Créer"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

function DeleteGestionnaireDialog({
  gestionnaire,
  bienCount,
  gestionnaires,
  onConfirm,
  onCancel,
  isPending,
}: {
  gestionnaire: Gestionnaire;
  bienCount: number;
  gestionnaires: Gestionnaire[];
  onConfirm: (reassignTo?: number) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [reassignTo, setReassignTo] = useState<string>("");

  const otherGestionnaires = gestionnaires.filter((g) => g.id !== gestionnaire.id);
  const mustReassign = bienCount > 0;
  const cannotDelete = mustReassign && otherGestionnaires.length === 0;
  const confirmDisabled = isPending || cannotDelete || (mustReassign && !reassignTo);

  const handleConfirm = () => {
    if (mustReassign && reassignTo) {
      onConfirm(parseInt(reassignTo));
    } else if (!mustReassign) {
      onConfirm(undefined);
    }
  };

  return (
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Supprimer le gestionnaire</AlertDialogTitle>
        <AlertDialogDescription asChild>
          <div className="space-y-3">
            <p>
              Êtes-vous sûr de vouloir supprimer <strong>{gestionnaire.nom}</strong> ?
            </p>
            {bienCount > 0 && (
              <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-200">
                <p className="font-medium mb-2">
                  ⚠️ {bienCount} bien{bienCount > 1 ? "s" : ""} {bienCount > 1 ? "sont rattachés" : "est rattaché"} à ce gestionnaire.
                </p>
                {otherGestionnaires.length > 0 ? (
                  <div className="space-y-2">
                    <p>Vous devez réassigner ces biens à un autre gestionnaire avant de supprimer :</p>
                    <Select value={reassignTo} onValueChange={setReassignTo}>
                      <SelectTrigger data-testid="select-reassign-gestionnaire">
                        <SelectValue placeholder="Choisir un gestionnaire..." />
                      </SelectTrigger>
                      <SelectContent>
                        {otherGestionnaires.map((g) => (
                          <SelectItem key={g.id} value={g.id.toString()} data-testid={`option-reassign-${g.id}`}>
                            {g.nom}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <p className="font-medium">
                    Impossible de supprimer : créez d'abord un autre gestionnaire pour réassigner ces biens.
                  </p>
                )}
              </div>
            )}
          </div>
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel onClick={onCancel} data-testid="button-cancel-delete">Annuler</AlertDialogCancel>
        <Button
          variant="destructive"
          onClick={handleConfirm}
          disabled={confirmDisabled}
          data-testid="button-confirm-delete"
        >
          {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Supprimer
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  );
}

export default function GestionnairesList() {
  const { toast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editingGestionnaire, setEditingGestionnaire] = useState<Gestionnaire | undefined>(undefined);
  const [deletingGestionnaire, setDeletingGestionnaire] = useState<Gestionnaire | undefined>(undefined);
  const [bienCountForDelete, setBienCountForDelete] = useState(0);

  const { data: gestionnairesList, isLoading } = useQuery<Gestionnaire[]>({
    queryKey: ["/api/gestionnaires"],
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id, reassignTo }: { id: number; reassignTo?: number }) => {
      const res = await apiRequest("DELETE", `/api/gestionnaires/${id}`, reassignTo !== undefined ? { reassignTo } : {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gestionnaires"] });
      queryClient.invalidateQueries({ queryKey: ["/api/biens"] });
      toast({ title: "Gestionnaire supprimé avec succès" });
      setDeletingGestionnaire(undefined);
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const handleEditClick = (gestionnaire: Gestionnaire) => {
    setEditingGestionnaire(gestionnaire);
    setFormOpen(true);
  };

  const handleCreateClick = () => {
    setEditingGestionnaire(undefined);
    setFormOpen(true);
  };

  const handleDeleteClick = async (gestionnaire: Gestionnaire) => {
    try {
      const res = await fetch(`/api/gestionnaires/${gestionnaire.id}/biens-count`);
      const data = await res.json();
      setBienCountForDelete(data.count);
      setDeletingGestionnaire(gestionnaire);
    } catch {
      setBienCountForDelete(0);
      setDeletingGestionnaire(gestionnaire);
    }
  };

  const handleFormSuccess = () => {
    setFormOpen(false);
    setEditingGestionnaire(undefined);
  };

  const handleDeleteConfirm = (reassignTo?: number) => {
    if (!deletingGestionnaire) return;
    deleteMutation.mutate({ id: deletingGestionnaire.id, reassignTo });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <Link href="/biens">
              <Button variant="ghost" size="sm" data-testid="button-back-biens">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Biens
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-semibold text-foreground" data-testid="text-page-title">
                Gestionnaires
              </h1>
              <p className="text-muted-foreground mt-1">
                {gestionnairesList ? `${gestionnairesList.length} gestionnaire${gestionnairesList.length > 1 ? "s" : ""}` : "Chargement..."}
              </p>
            </div>
          </div>
          <Button onClick={handleCreateClick} data-testid="button-create-gestionnaire">
            <Plus className="w-4 h-4 mr-2" />
            Nouveau gestionnaire
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="p-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-md" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-1/3" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : gestionnairesList && gestionnairesList.length > 0 ? (
          <div className="space-y-3">
            {gestionnairesList.map((gestionnaire) => (
              <Card key={gestionnaire.id} className="p-4" data-testid={`card-gestionnaire-${gestionnaire.id}`}>
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center h-10 w-10 rounded-md bg-primary/10 text-primary shrink-0">
                    <Users className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-foreground" data-testid={`text-gestionnaire-nom-${gestionnaire.id}`}>
                      {gestionnaire.nom}
                    </h3>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mt-0.5">
                      {gestionnaire.adresse && (
                        <span className="flex items-center gap-1" data-testid={`text-gestionnaire-adresse-${gestionnaire.id}`}>
                          <MapPin className="w-3.5 h-3.5 shrink-0" />
                          {gestionnaire.adresse}
                        </span>
                      )}
                      {gestionnaire.email && (
                        <span className="flex items-center gap-1" data-testid={`text-gestionnaire-email-${gestionnaire.id}`}>
                          <Mail className="w-3.5 h-3.5 shrink-0" />
                          {gestionnaire.email}
                        </span>
                      )}
                      {gestionnaire.telephone && (
                        <span className="flex items-center gap-1" data-testid={`text-gestionnaire-telephone-${gestionnaire.id}`}>
                          <Phone className="w-3.5 h-3.5 shrink-0" />
                          {gestionnaire.telephone}
                        </span>
                      )}
                      {!gestionnaire.adresse && !gestionnaire.email && !gestionnaire.telephone && (
                        <span className="italic">Aucune coordonnée</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditClick(gestionnaire)}
                      data-testid={`button-edit-gestionnaire-${gestionnaire.id}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteClick(gestionnaire)}
                      className="text-destructive hover:text-destructive"
                      data-testid={`button-delete-gestionnaire-${gestionnaire.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-1" data-testid="text-empty-title">Aucun gestionnaire</h3>
            <p className="text-muted-foreground mb-4">
              Commencez par ajouter votre premier gestionnaire.
            </p>
            <Button onClick={handleCreateClick} data-testid="button-empty-create">
              <Plus className="w-4 h-4 mr-2" />
              Ajouter un gestionnaire
            </Button>
          </Card>
        )}
      </div>

      <Dialog open={formOpen} onOpenChange={(open) => { if (!open) { setFormOpen(false); setEditingGestionnaire(undefined); } }}>
        <DialogContent data-testid="dialog-gestionnaire-form">
          <DialogHeader>
            <DialogTitle>
              {editingGestionnaire ? "Modifier le gestionnaire" : "Nouveau gestionnaire"}
            </DialogTitle>
          </DialogHeader>
          <GestionnaireForm
            gestionnaire={editingGestionnaire}
            onSuccess={handleFormSuccess}
            onCancel={() => { setFormOpen(false); setEditingGestionnaire(undefined); }}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingGestionnaire} onOpenChange={(open) => { if (!open) setDeletingGestionnaire(undefined); }}>
        {deletingGestionnaire && (
          <DeleteGestionnaireDialog
            gestionnaire={deletingGestionnaire}
            bienCount={bienCountForDelete}
            gestionnaires={gestionnairesList ?? []}
            onConfirm={handleDeleteConfirm}
            onCancel={() => setDeletingGestionnaire(undefined)}
            isPending={deleteMutation.isPending}
          />
        )}
      </AlertDialog>
    </div>
  );
}
