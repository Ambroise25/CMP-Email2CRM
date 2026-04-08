import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import type { DemandeWithRelations, PaginatedResponse } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Mail,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Building2,
  Wrench,
  Calendar,
  Pencil,
  ClipboardList,
  Wifi,
  WifiOff,
  Clock,
  MessageSquare,
} from "lucide-react";

interface EmailServiceStatus {
  enabled: boolean;
  intervalMs: number;
  lastCheck: string | null;
  nextCheck: string | null;
  lastError: string | null;
}

const metierColors: Record<string, string> = {
  Etancheite: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  Plomberie: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  Electricite: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  Autre: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

function formatDate(dateStr: string | Date) {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatIntervalLabel(ms: number) {
  const min = Math.round(ms / 60000);
  return `toutes les ${min} min`;
}

export default function EmailsList() {
  const [page, setPage] = useState(1);
  const limit = 20;
  const { toast } = useToast();

  const { data, isLoading } = useQuery<PaginatedResponse<DemandeWithRelations>>({
    queryKey: ["/api/demandes", "nouvelle", page],
    queryFn: () =>
      fetch(`/api/demandes?etat=nouvelle&page=${page}&limit=${limit}`).then((r) => r.json()),
  });

  const { data: status } = useQuery<EmailServiceStatus>({
    queryKey: ["/api/emails/status"],
    refetchInterval: 30000,
  });

  const syncMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/emails/sync"),
    onSuccess: async (res) => {
      const result = await res.json();
      toast({
        title: "Synchronisation terminée",
        description: `${result.processed} nouvelle(s) demande(s) créée(s)`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/demandes", "nouvelle"] });
    },
    onError: () => {
      toast({ title: "Erreur de synchronisation", variant: "destructive" });
    },
  });

  const validateMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest("PUT", `/api/demandes/${id}`, { etat: "a_contacter" }),
    onSuccess: () => {
      toast({
        title: "Demande validée",
        description: "Déplacée vers le suivi des demandes.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/demandes"] });
    },
    onError: () => {
      toast({ title: "Erreur lors de la validation", variant: "destructive" });
    },
  });

  const demandes = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-8">

        <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-md bg-primary/10 text-primary">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-foreground" data-testid="text-page-title">
                Nouvelles demandes
              </h1>
              <p className="text-sm text-muted-foreground">
                {pagination ? `${pagination.total} demande${pagination.total > 1 ? "s" : ""} à traiter` : "Chargement..."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div
              className="flex items-center gap-2 text-sm text-muted-foreground"
              data-testid="status-email-service"
            >
              {status?.enabled ? (
                <Wifi className="h-4 w-4 text-green-500" />
              ) : (
                <WifiOff className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="hidden sm:inline">
                {status?.enabled
                  ? `Polling actif — ${formatIntervalLabel(status.intervalMs)}`
                  : "Service désactivé"}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              data-testid="button-sync-emails"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? "animate-spin" : ""}`} />
              {syncMutation.isPending ? "En cours..." : "Synchroniser"}
            </Button>
          </div>
        </div>

        {status?.lastCheck && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Clock className="h-3 w-3" />
            <span>Dernier check : {new Date(status.lastCheck).toLocaleString("fr-FR")}</span>
          </div>
        )}

        <div className="flex items-center justify-between mb-6 mt-4">
          <div className="flex gap-2">
            <Link href="/demandes">
              <Button variant="outline" size="sm" data-testid="link-suivi-demandes">
                <ClipboardList className="w-4 h-4 mr-2" />
                Suivi des demandes
              </Button>
            </Link>
            <Link href="/biens">
              <Button variant="ghost" size="sm" data-testid="link-biens">
                <Building2 className="w-4 h-4 mr-2" />
                Biens
              </Button>
            </Link>
          </div>
        </div>

        <div className="space-y-3">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="p-5">
                <Skeleton className="h-5 w-3/4 mb-3" />
                <Skeleton className="h-4 w-1/2 mb-2" />
                <Skeleton className="h-4 w-2/3" />
              </Card>
            ))
          ) : demandes.length === 0 ? (
            <Card className="p-12 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-400 mx-auto mb-4" />
              <p className="text-lg font-medium text-foreground">
                Aucune nouvelle demande
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Toutes les demandes ont été traitées. Cliquez sur "Synchroniser" pour vérifier les nouveaux emails.
              </p>
            </Card>
          ) : (
            demandes.map((demande) => (
              <Card
                key={demande.id}
                className="p-5"
                data-testid={`card-demande-${demande.id}`}
              >
                <div className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3
                          className="font-semibold text-foreground"
                          data-testid={`text-objet-${demande.id}`}
                        >
                          {demande.objet}
                        </h3>
                        <Badge
                          className={metierColors[demande.metier] ?? ""}
                          data-testid={`badge-metier-${demande.id}`}
                        >
                          <Wrench className="w-3 h-3 mr-1" />
                          {demande.metier}
                        </Badge>
                        <Badge variant="outline" data-testid={`badge-id-${demande.id}`}>
                          #{demande.id}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1" data-testid={`text-adresse-${demande.id}`}>
                          <Building2 className="w-3.5 h-3.5" />
                          {demande.bien?.adresse}, {demande.bien?.codePostal} {demande.bien?.ville}
                        </span>
                        <span className="flex items-center gap-1" data-testid={`text-date-${demande.id}`}>
                          <Calendar className="w-3.5 h-3.5" />
                          {formatDate(demande.dateDemandeClient)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {demande.commentaire && (
                    <div className="bg-muted/50 rounded-md px-3 py-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1.5 mb-1 font-medium text-foreground">
                        <MessageSquare className="w-3.5 h-3.5" />
                        Informations parsées
                      </div>
                      <pre className="whitespace-pre-wrap font-sans text-xs" data-testid={`text-commentaire-${demande.id}`}>
                        {demande.commentaire}
                      </pre>
                    </div>
                  )}

                  {demande.detail && (
                    <div className="text-sm text-muted-foreground line-clamp-2" data-testid={`text-detail-${demande.id}`}>
                      {demande.detail}
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={() => validateMutation.mutate(demande.id)}
                      disabled={validateMutation.isPending}
                      data-testid={`button-valider-${demande.id}`}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Valider
                    </Button>
                    <Link href={`/demandes/${demande.id}/edit`}>
                      <Button variant="outline" size="sm" data-testid={`button-modifier-${demande.id}`}>
                        <Pencil className="w-4 h-4 mr-2" />
                        Modifier
                      </Button>
                    </Link>
                    <Link href={`/demandes/${demande.id}`}>
                      <Button variant="ghost" size="sm" data-testid={`button-voir-${demande.id}`}>
                        Voir le détail
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>

        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <p className="text-sm text-muted-foreground">
              {pagination.total} demande(s) au total
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                data-testid="button-prev-page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                {page} / {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={page === pagination.totalPages}
                data-testid="button-next-page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
