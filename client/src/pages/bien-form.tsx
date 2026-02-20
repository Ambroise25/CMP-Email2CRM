import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertBienSchema, type BienWithGestionnaire, type Gestionnaire } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
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
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { Link } from "wouter";

const formSchema = insertBienSchema.extend({
  adresse: z.string().min(1, "L'adresse est requise"),
  codePostal: z.string().min(1, "Le code postal est requis").regex(/^\d{5}$/, "Le code postal doit contenir 5 chiffres"),
  ville: z.string().min(1, "La ville est requise"),
  gestionnaireId: z.coerce.number().min(1, "Le gestionnaire est requis"),
});

type FormValues = z.infer<typeof formSchema>;

export default function BienForm() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const isEdit = !!id;

  const { data: bien, isLoading: bienLoading } = useQuery<BienWithGestionnaire>({
    queryKey: ["/api/biens", id],
    enabled: isEdit,
  });

  const { data: gestionnairesList, isLoading: gestionnairesLoading } = useQuery<Gestionnaire[]>({
    queryKey: ["/api/gestionnaires"],
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      adresse: "",
      complementAdresse: "",
      codePostal: "",
      ville: "",
      gestionnaireId: 0,
      information: "",
    },
    values: isEdit && bien ? {
      adresse: bien.adresse,
      complementAdresse: bien.complementAdresse || "",
      codePostal: bien.codePostal,
      ville: bien.ville,
      gestionnaireId: bien.gestionnaireId,
      information: bien.information || "",
    } : undefined,
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const res = await apiRequest("POST", "/api/biens", data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/biens"] });
      toast({ title: "Bien cree avec succes", description: `ID: ${data.id}` });
      navigate(`/biens/${data.id}`);
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const res = await apiRequest("PUT", `/api/biens/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/biens"] });
      queryClient.invalidateQueries({ queryKey: ["/api/biens", id] });
      toast({ title: "Bien mis a jour avec succes" });
      navigate(`/biens/${id}`);
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

  if (isEdit && bienLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <Skeleton className="h-8 w-48 mb-8" />
          <Card className="p-6 space-y-6">
            {Array.from({ length: 5 }).map((_, i) => (
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
          <Link href={isEdit ? `/biens/${id}` : "/"}>
            <Button variant="ghost" data-testid="button-back">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour
            </Button>
          </Link>
          <h1 className="text-xl font-semibold text-foreground" data-testid="text-form-title">
            {isEdit ? "Modifier le bien" : "Nouveau bien"}
          </h1>
        </div>

        <Card className="p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="adresse"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Adresse *</FormLabel>
                    <FormControl>
                      <Input placeholder="12 Rue des Econdeaux" {...field} data-testid="input-adresse" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="complementAdresse"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Complement d'adresse</FormLabel>
                    <FormControl>
                      <Input placeholder="Batiment A, Escalier B..." {...field} value={field.value || ""} data-testid="input-complement" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="codePostal"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Code postal *</FormLabel>
                      <FormControl>
                        <Input placeholder="93800" maxLength={5} {...field} data-testid="input-code-postal" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="ville"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ville *</FormLabel>
                      <FormControl>
                        <Input placeholder="Epinay-sur-Seine" {...field} data-testid="input-ville" />
                      </FormControl>
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
                    <Select
                      onValueChange={(val) => field.onChange(parseInt(val))}
                      value={field.value ? field.value.toString() : ""}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-gestionnaire">
                          <SelectValue placeholder="Selectionner un gestionnaire" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {gestionnairesLoading ? (
                          <div className="p-2 text-center text-sm text-muted-foreground">Chargement...</div>
                        ) : gestionnairesList?.map((g) => (
                          <SelectItem key={g.id} value={g.id.toString()} data-testid={`option-gestionnaire-${g.id}`}>
                            {g.nom}
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
                name="information"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Informations complementaires</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Notes, details sur le bien..."
                        className="resize-none"
                        rows={3}
                        {...field}
                        value={field.value || ""}
                        data-testid="textarea-information"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={isPending} data-testid="button-submit">
                  {isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  {isEdit ? "Mettre a jour" : "Creer le bien"}
                </Button>
              </div>
            </form>
          </Form>
        </Card>
      </div>
    </div>
  );
}
