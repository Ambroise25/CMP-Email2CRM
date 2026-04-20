import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  insertDemandeSchema,
  type DemandeWithRelations,
  type Gestionnaire,
  type BienWithGestionnaire,
  type PaginatedResponse,
  ETATS,
  METIERS,
  etatLabels,
} from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
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
import { GestionnaireCombobox } from "@/components/gestionnaire-combobox";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { Link } from "wouter";

const formSchema = insertDemandeSchema.extend({
  objet: z.string().min(1, "L'objet est requis"),
  bienId: z.coerce.number().min(1, "Le bien est requis"),
  gestionnaireId: z.coerce.number().min(1, "Le gestionnaire est requis"),
  metier: z.enum(METIERS, { required_error: "Le metier est requis" }),
  etat: z.enum(ETATS).default("nouvelle"),
  dateDemandeClient: z.coerce.date({ required_error: "La date est requise" }),
});

type FormValues = z.infer<typeof formSchema>;

export default function DemandeForm() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const isEdit = !!id;

  const { data: demande, isLoading: demandeLoading } = useQuery<DemandeWithRelations>({
    queryKey: ["/api/demandes", id],
    enabled: isEdit,
  });

  const { data: biensData, isLoading: biensLoading } = useQuery<PaginatedResponse<BienWithGestionnaire>>({
    queryKey: ["/api/biens", "?page=1&limit=100"],
  });

  const { data: gestionnairesList, isLoading: gestionnairesLoading } = useQuery<Gestionnaire[]>({
    queryKey: ["/api/gestionnaires"],
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      objet: "",
      bienId: 0,
      gestionnaireId: 0,
      metier: undefined as unknown as typeof METIERS[number],
      etat: "nouvelle" as typeof ETATS[number],
      detail: "",
      commentaire: "",
      dateDemandeClient: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate(), 12),
      refSyndic: "",
      travauxEnerpur: false,
    },
    values: isEdit && demande ? {
      objet: demande.objet,
      bienId: demande.bienId,
      gestionnaireId: demande.gestionnaireId ?? 0,
      metier: demande.metier as typeof METIERS[number],
      etat: demande.etat as typeof ETATS[number],
      detail: demande.detail || "",
      commentaire: demande.commentaire || "",
      dateDemandeClient: new Date(demande.dateDemandeClient),
      refSyndic: demande.refSyndic || "",
      travauxEnerpur: demande.travauxEnerpur || false,
    } : undefined,
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const res = await apiRequest("POST", "/api/demandes", data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/demandes"] });
      toast({ title: "Demande creee avec succes", description: `ID: ${data.id}` });
      navigate(`/demandes/${data.id}`);
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const res = await apiRequest("PUT", `/api/demandes/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/demandes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/demandes", id] });
      toast({ title: "Demande mise a jour avec succes" });
      navigate(`/demandes/${id}`);
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

  if (isEdit && demandeLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <Skeleton className="h-8 w-48 mb-8" />
          <Card className="p-6 space-y-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-6">
          <Link href={isEdit ? `/demandes/${id}` : "/demandes"}>
            <Button variant="ghost" data-testid="button-back">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour
            </Button>
          </Link>
          <h1 className="text-xl font-semibold text-foreground" data-testid="text-form-title">
            {isEdit ? "Modifier la demande" : "Nouvelle demande"}
          </h1>
        </div>

        <Card className="p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="objet"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Objet *</FormLabel>
                    <FormControl>
                      <Input placeholder="Description courte de la demande" {...field} data-testid="input-objet" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bienId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bien *</FormLabel>
                    <Select
                      onValueChange={(val) => field.onChange(parseInt(val))}
                      value={field.value ? field.value.toString() : ""}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-bien">
                          <SelectValue placeholder="Selectionner un bien" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {biensLoading ? (
                          <div className="p-2 text-center text-sm text-muted-foreground">Chargement...</div>
                        ) : biensData?.data.map((b) => (
                          <SelectItem key={b.id} value={b.id.toString()} data-testid={`option-bien-${b.id}`}>
                            {b.adresse} - {b.codePostal} {b.ville}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="metier"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Metier *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || ""}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-metier">
                            <SelectValue placeholder="Selectionner un metier" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {METIERS.map((metier) => (
                            <SelectItem key={metier} value={metier}>
                              {metier}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="etat"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Etat</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || "nouvelle"}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-etat">
                            <SelectValue placeholder="Selectionner un etat" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ETATS.map((etat) => (
                            <SelectItem key={etat} value={etat}>
                              {etatLabels[etat]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="gestionnaireId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gestionnaire *</FormLabel>
                    <FormControl>
                      <GestionnaireCombobox
                        value={field.value || null}
                        onChange={(id) => field.onChange(id)}
                        gestionnaires={gestionnairesList ?? []}
                        disabled={gestionnairesLoading}
                        data-testid="select-gestionnaire"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dateDemandeClient"
                render={({ field }) => {
                  const dateValue = field.value ? new Date(field.value) : null;
                  const formattedDate = dateValue && !isNaN(dateValue.getTime())
                    ? dateValue.toISOString().split("T")[0]
                    : "";
                  return (
                    <FormItem>
                      <FormLabel>Date demande client *</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          value={formattedDate}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val) {
                              const parts = val.split("-");
                              const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 12);
                              field.onChange(d);
                            }
                          }}
                          data-testid="input-date-demande"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              <FormField
                control={form.control}
                name="detail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Detail</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Description detaillee de l'intervention..."
                        className="resize-none"
                        rows={3}
                        {...field}
                        value={field.value || ""}
                        data-testid="textarea-detail"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="commentaire"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Commentaire</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Commentaires additionnels..."
                        className="resize-none"
                        rows={2}
                        {...field}
                        value={field.value || ""}
                        data-testid="textarea-commentaire"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="refSyndic"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reference syndic</FormLabel>
                      <FormControl>
                        <Input placeholder="SYN-2026-001" {...field} value={field.value || ""} data-testid="input-ref-syndic" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="travauxEnerpur"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-end space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value || false}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-travaux-enerpur"
                        />
                      </FormControl>
                      <FormLabel className="font-normal">
                        Travaux Enerpur
                      </FormLabel>
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={isPending} data-testid="button-submit">
                  {isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  {isEdit ? "Mettre a jour" : "Creer la demande"}
                </Button>
              </div>
            </form>
          </Form>
        </Card>
      </div>
    </div>
  );
}
