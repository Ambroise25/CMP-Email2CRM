import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import type { DemandeWithRelations, PaginatedResponse } from "@shared/schema";
import { METIERS, etatLabels } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ClipboardList,
  Plus,
  ChevronLeft,
  ChevronRight,
  Building2,
  User,
  Calendar,
  Wrench,
  ArrowLeft,
} from "lucide-react";

const SUIVI_ETATS = [
  { value: "", label: "Toutes" },
  { value: "a_contacter", label: "À contacter" },
  { value: "en_attente_retour", label: "En attente de retour" },
  { value: "programmee", label: "Programmée" },
  { value: "terminee", label: "Terminée" },
  { value: "annulee", label: "Annulée" },
] as const;

const etatColors: Record<string, string> = {
  a_contacter: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  en_attente_retour: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  programmee: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  terminee: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  annulee: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  nouvelle: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
};

export default function DemandesList() {
  const [page, setPage] = useState(1);
  const [etatFilter, setEtatFilter] = useState<string>("");
  const [metierFilter, setMetierFilter] = useState<string>("");
  const limit = 20;

  let queryString = `?page=${page}&limit=${limit}&exclude_nouvelle=true`;
  if (etatFilter) queryString += `&etat=${etatFilter}`;
  if (metierFilter) queryString += `&metier=${metierFilter}`;

  const { data, isLoading } = useQuery<PaginatedResponse<DemandeWithRelations>>({
    queryKey: ["/api/demandes", queryString],
  });

  const handleBadgeFilter = (val: string) => {
    setEtatFilter(val);
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8">

        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link href="/">
                <Button variant="ghost" size="sm" data-testid="button-back-nouvelles">
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Nouvelles demandes
                </Button>
              </Link>
            </div>
            <h1 className="text-2xl font-semibold text-foreground" data-testid="text-page-title">
              Suivi des demandes
            </h1>
            <p className="text-muted-foreground mt-1">
              {data
                ? `${data.pagination.total} demande${data.pagination.total > 1 ? "s" : ""}`
                : "Chargement..."}
            </p>
          </div>
          <Link href="/demandes/new">
            <Button data-testid="button-create-demande">
              <Plus className="w-4 h-4 mr-2" />
              Nouvelle demande
            </Button>
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          {SUIVI_ETATS.map(({ value, label }) => (
            <Button
              key={value}
              variant={etatFilter === value ? "default" : "outline"}
              size="sm"
              onClick={() => handleBadgeFilter(value)}
              data-testid={`badge-filter-${value || "toutes"}`}
            >
              {label}
            </Button>
          ))}
        </div>

        <div className="mb-6">
          <Select
            value={metierFilter}
            onValueChange={(val) => {
              setMetierFilter(val === "all" ? "" : val);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[180px]" data-testid="select-filter-metier">
              <SelectValue placeholder="Tous les métiers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les métiers</SelectItem>
              {METIERS.map((metier) => (
                <SelectItem key={metier} value={metier}>
                  {metier}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} className="p-4">
                <div className="flex items-start gap-4">
                  <Skeleton className="h-10 w-10 rounded-md" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : data && data.data.length > 0 ? (
          <div className="space-y-3">
            {data.data.map((demande) => (
              <Link key={demande.id} href={`/demandes/${demande.id}`}>
                <Card
                  className="p-4 hover-elevate cursor-pointer transition-colors"
                  data-testid={`card-demande-${demande.id}`}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex items-center justify-center h-10 w-10 rounded-md bg-primary/10 text-primary shrink-0">
                      <ClipboardList className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3
                          className="font-medium text-foreground truncate"
                          data-testid={`text-objet-${demande.id}`}
                        >
                          {demande.objet}
                        </h3>
                        <Badge
                          className={etatColors[demande.etat] || ""}
                          data-testid={`badge-etat-${demande.id}`}
                        >
                          {etatLabels[demande.etat as keyof typeof etatLabels] || demande.etat}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5" />
                          {demande.bien?.adresse}
                        </span>
                        <span className="flex items-center gap-1">
                          <Wrench className="w-3.5 h-3.5" />
                          {demande.metier}
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5" />
                          {demande.gestionnaire?.nom}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {new Date(demande.dateDemandeClient).toLocaleDateString("fr-FR")}
                        </span>
                      </div>
                    </div>
                    <Badge variant="outline" className="shrink-0" data-testid={`badge-id-${demande.id}`}>
                      #{demande.id}
                    </Badge>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <ClipboardList className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-1" data-testid="text-empty-title">
              Aucune demande trouvée
            </h3>
            <p className="text-muted-foreground mb-4">
              {etatFilter || metierFilter
                ? "Aucun résultat pour ces filtres."
                : "Les nouvelles demandes validées apparaîtront ici."}
            </p>
          </Card>
        )}

        {data && data.pagination.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              data-testid="button-prev-page"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Précédent
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(data.pagination.totalPages, 7) }).map((_, i) => {
                const pageNum = i + 1;
                return (
                  <Button
                    key={pageNum}
                    variant={pageNum === page ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setPage(pageNum)}
                    data-testid={`button-page-${pageNum}`}
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= data.pagination.totalPages}
              onClick={() => setPage(page + 1)}
              data-testid="button-next-page"
            >
              Suivant
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
