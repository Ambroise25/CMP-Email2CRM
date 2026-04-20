import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import type { BienWithGestionnaire, PaginatedResponse } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Building2,
  MapPin,
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  User,
  Info,
  ClipboardList,
  Mail,
  Users,
  UserX,
  RefreshCw,
  CheckCircle,
  Download,
} from "lucide-react";

export default function BiensList() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [sansGestionnaire, setSansGestionnaire] = useState(false);
  const [reassignResult, setReassignResult] = useState<{
    demandesUpdated: number;
    biensUpdated: number;
    unmatched: string[];
  } | null>(null);
  const limit = 20;
  const { toast } = useToast();

  const queryKey = [
    "/api/biens",
    `?page=${page}&limit=${limit}${search ? `&search=${search}` : ""}${sansGestionnaire ? "&sans_gestionnaire=1" : ""}`,
  ];

  const { data, isLoading } = useQuery<PaginatedResponse<BienWithGestionnaire>>({
    queryKey,
  });

  const reassignMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/reassign-gestionnaires"),
    onSuccess: async (res) => {
      const result = await res.json();
      setReassignResult(result);
      queryClient.invalidateQueries({ queryKey: ["/api/biens"] });
      toast({
        title: "Réassignation terminée",
        description: `${result.demandesUpdated} demandes et ${result.biensUpdated} biens mis à jour.`,
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de lancer la réassignation.",
        variant: "destructive",
      });
    },
  });

  const importSyndicsMutation = useMutation({
    mutationFn: (names: string[]) =>
      apiRequest("POST", "/api/admin/import-syndics", { names }),
    onSuccess: async (res) => {
      const result = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/gestionnaires"] });
      const parts = [`${result.created} créé(s)`];
      if (result.skipped > 0) parts.push(`${result.skipped} ignoré(s)`);
      toast({
        title: "Syndics importés",
        description: `${parts.join(", ")}. Lancement de la réassignation...`,
      });
      reassignMutation.mutate();
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible d'importer les syndics.",
        variant: "destructive",
      });
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const handleToggleSansGestionnaire = () => {
    setSansGestionnaire((v) => !v);
    setPage(1);
  };

  const orphanCount = data?.data.filter((b) => !b.gestionnaire).length ?? 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-foreground" data-testid="text-page-title">
              Gestion des Biens
            </h1>
            <p className="text-muted-foreground mt-1">
              {data ? `${data.pagination.total} bien${data.pagination.total > 1 ? "s" : ""} enregistre${data.pagination.total > 1 ? "s" : ""}` : "Chargement..."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/">
              <Button variant="outline" data-testid="button-nouvelles-demandes">
                <Mail className="w-4 h-4 mr-2" />
                Nouvelles demandes
              </Button>
            </Link>
            <Link href="/demandes">
              <Button variant="outline" data-testid="button-demandes-page">
                <ClipboardList className="w-4 h-4 mr-2" />
                Suivi des demandes
              </Button>
            </Link>
            <Link href="/gestionnaires">
              <Button variant="outline" data-testid="button-gestionnaires-page">
                <Users className="w-4 h-4 mr-2" />
                Gestionnaires
              </Button>
            </Link>
            <Link href="/biens/search">
              <Button variant="outline" data-testid="button-search-page">
                <Search className="w-4 h-4 mr-2" />
                Recherche avancee
              </Button>
            </Link>
            <Link href="/biens/new">
              <Button data-testid="button-create-bien">
                <Plus className="w-4 h-4 mr-2" />
                Nouveau bien
              </Button>
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mb-6">
          <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-[280px]">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Rechercher par adresse, ville ou code postal..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-10"
                data-testid="input-search"
              />
            </div>
            <Button type="submit" variant="secondary" data-testid="button-search-submit">
              Rechercher
            </Button>
          </form>
          <Button
            variant={sansGestionnaire ? "default" : "outline"}
            onClick={handleToggleSansGestionnaire}
            data-testid="button-filter-sans-gestionnaire"
          >
            <UserX className="w-4 h-4 mr-2" />
            Sans gestionnaire
          </Button>
          <Button
            variant="outline"
            onClick={() => reassignMutation.mutate()}
            disabled={reassignMutation.isPending}
            data-testid="button-reassign-gestionnaires"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${reassignMutation.isPending ? "animate-spin" : ""}`} />
            {reassignMutation.isPending ? "Réassignation..." : "Réassigner les gestionnaires"}
          </Button>
        </div>

        {reassignResult && (
          <Alert className="mb-6" data-testid="alert-reassign-result">
            <CheckCircle className="h-4 w-4" />
            <AlertTitle>Réassignation terminée</AlertTitle>
            <AlertDescription>
              <p>
                <strong>{reassignResult.demandesUpdated}</strong> demandes et{" "}
                <strong>{reassignResult.biensUpdated}</strong> biens ont été réassignés à leur gestionnaire.
              </p>
              {reassignResult.unmatched.length > 0 && (
                <div className="mt-3">
                  <details>
                    <summary className="cursor-pointer text-sm text-muted-foreground">
                      {reassignResult.unmatched.length} syndic(s) non identifié(s) — cliquer pour voir la liste
                    </summary>
                    <ul className="mt-1 text-sm text-muted-foreground list-disc list-inside">
                      {reassignResult.unmatched.map((name) => (
                        <li key={name}>{name}</li>
                      ))}
                    </ul>
                  </details>
                  <Button
                    size="sm"
                    className="mt-2"
                    onClick={() => importSyndicsMutation.mutate(reassignResult.unmatched)}
                    disabled={importSyndicsMutation.isPending || reassignMutation.isPending}
                    data-testid="button-import-syndics"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    {importSyndicsMutation.isPending || reassignMutation.isPending
                      ? "Import en cours..."
                      : `Importer ${reassignResult.unmatched.length} syndic(s) et réassigner`}
                  </Button>
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

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
            {data.data.map((bien) => (
              <Link key={bien.id} href={`/biens/${bien.id}`}>
                <Card
                  className="p-4 hover-elevate cursor-pointer transition-colors"
                  data-testid={`card-bien-${bien.id}`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`flex items-center justify-center h-10 w-10 rounded-md shrink-0 ${bien.gestionnaire ? "bg-primary/10 text-primary" : "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"}`}>
                      {bien.gestionnaire ? <Building2 className="w-5 h-5" /> : <UserX className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="font-medium text-foreground truncate" data-testid={`text-adresse-${bien.id}`}>
                          {bien.adresse}
                        </h3>
                        {bien.complementAdresse && (
                          <Badge variant="secondary" data-testid={`badge-complement-${bien.id}`}>
                            {bien.complementAdresse}
                          </Badge>
                        )}
                        {!bien.gestionnaire && (
                          <Badge variant="outline" className="text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-700" data-testid={`badge-sans-gestionnaire-${bien.id}`}>
                            Sans gestionnaire
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          {bien.codePostal} {bien.ville}
                        </span>
                        <span className="flex items-center gap-1" data-testid={`text-gestionnaire-${bien.id}`}>
                          <User className="w-3.5 h-3.5" />
                          {bien.gestionnaire?.nom ?? <em>Non assigné</em>}
                        </span>
                        {bien.information && (
                          <span className="flex items-center gap-1">
                            <Info className="w-3.5 h-3.5" />
                            <span className="truncate max-w-[200px]">{bien.information}</span>
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline" className="shrink-0" data-testid={`badge-id-${bien.id}`}>
                      #{bien.id}
                    </Badge>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-1" data-testid="text-empty-title">Aucun bien trouve</h3>
            <p className="text-muted-foreground mb-4">
              {search ? "Aucun resultat pour cette recherche." : sansGestionnaire ? "Tous les biens ont un gestionnaire assigné." : "Commencez par ajouter votre premier bien."}
            </p>
            {!search && !sansGestionnaire && (
              <Link href="/biens/new">
                <Button data-testid="button-empty-create">
                  <Plus className="w-4 h-4 mr-2" />
                  Ajouter un bien
                </Button>
              </Link>
            )}
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
              Precedent
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
