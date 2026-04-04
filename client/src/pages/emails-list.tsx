import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import type { EmailLog, PaginatedResponse } from "@shared/schema";
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
  CheckCircle,
  XCircle,
  MinusCircle,
  ArrowLeft,
  Clock,
  Wifi,
  WifiOff,
} from "lucide-react";

interface EmailServiceStatus {
  enabled: boolean;
  intervalMs: number;
  lastCheck: string | null;
  nextCheck: string | null;
  lastError: string | null;
}

const statutColors: Record<string, string> = {
  traite: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  erreur: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  ignore: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

const statutLabels: Record<string, string> = {
  traite: "Traité",
  erreur: "Erreur",
  ignore: "Ignoré",
};

const statutIcons: Record<string, typeof CheckCircle> = {
  traite: CheckCircle,
  erreur: XCircle,
  ignore: MinusCircle,
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
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

  const { data, isLoading } = useQuery<PaginatedResponse<EmailLog>>({
    queryKey: ["/api/emails/logs", page],
    queryFn: () => fetch(`/api/emails/logs?page=${page}&limit=${limit}`).then((r) => r.json()),
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
        description: `${result.processed} traité(s), ${result.errors} erreur(s), ${result.ignored} ignoré(s)`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/emails/logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/emails/status"] });
    },
    onError: (err) => {
      toast({
        title: "Erreur de synchronisation",
        description: String(err),
        variant: "destructive",
      });
    },
  });

  const emails = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/">
            <Button variant="ghost" size="sm" data-testid="link-back-home" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
          </Link>

          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <Mail className="h-7 w-7 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  Emails parsés
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Suivi des emails traités automatiquement
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div
                className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400"
                data-testid="status-email-service"
              >
                {status?.enabled ? (
                  <Wifi className="h-4 w-4 text-green-500" />
                ) : (
                  <WifiOff className="h-4 w-4 text-gray-400" />
                )}
                <span>
                  {status?.enabled
                    ? `Polling actif — ${formatIntervalLabel(status.intervalMs)}`
                    : "Service désactivé (secrets non configurés)"}
                </span>
              </div>

              <Button
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
                data-testid="button-sync-emails"
                size="sm"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? "animate-spin" : ""}`} />
                {syncMutation.isPending ? "En cours..." : "Synchroniser"}
              </Button>
            </div>
          </div>

          {status?.lastCheck && (
            <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
              <Clock className="h-3 w-3" />
              <span>Dernier check : {formatDate(status.lastCheck)}</span>
              {status.nextCheck && (
                <span>— Prochain : {formatDate(status.nextCheck)}</span>
              )}
            </div>
          )}

          {status?.lastError && (
            <div
              className="mt-2 text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950 px-3 py-2 rounded-md"
              data-testid="status-last-error"
            >
              Dernière erreur : {status.lastError}
            </div>
          )}
        </div>

        <div className="space-y-3">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} className="p-4">
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-3 w-1/2" />
              </Card>
            ))
          ) : emails.length === 0 ? (
            <Card className="p-12 text-center">
              <Mail className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">
                Aucun email traité pour l'instant
              </p>
              <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
                Cliquez sur "Synchroniser" pour lancer une première lecture
              </p>
            </Card>
          ) : (
            emails.map((email) => {
              const StatutIcon = statutIcons[email.statut] ?? MinusCircle;
              return (
                <Card
                  key={email.id}
                  className="p-4 hover:shadow-md transition-shadow"
                  data-testid={`card-email-${email.id}`}
                >
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-start gap-3 min-w-0">
                      <StatutIcon
                        className={`h-5 w-5 mt-0.5 flex-shrink-0 ${
                          email.statut === "traite"
                            ? "text-green-500"
                            : email.statut === "erreur"
                            ? "text-red-500"
                            : "text-gray-400"
                        }`}
                      />
                      <div className="min-w-0">
                        <p
                          className="font-medium text-gray-900 dark:text-gray-100 truncate"
                          data-testid={`text-subject-${email.id}`}
                        >
                          {email.subject}
                        </p>
                        <p
                          className="text-sm text-gray-500 dark:text-gray-400 truncate"
                          data-testid={`text-from-${email.id}`}
                        >
                          {email.from}
                        </p>
                        {email.erreur && (
                          <p
                            className="text-xs text-red-500 dark:text-red-400 mt-1"
                            data-testid={`text-error-${email.id}`}
                          >
                            {email.erreur}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <Badge
                        className={`text-xs ${statutColors[email.statut] ?? ""}`}
                        data-testid={`status-email-${email.id}`}
                      >
                        {statutLabels[email.statut] ?? email.statut}
                      </Badge>

                      {email.demandeId && (
                        <Link href={`/demandes/${email.demandeId}`}>
                          <Button
                            variant="outline"
                            size="sm"
                            data-testid={`link-demande-${email.id}`}
                          >
                            Voir demande #{email.demandeId}
                          </Button>
                        </Link>
                      )}

                      <span
                        className="text-xs text-gray-400"
                        data-testid={`text-date-${email.id}`}
                      >
                        {formatDate(email.receivedAt as unknown as string)}
                      </span>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>

        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {pagination.total} email(s) au total
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
              <span className="text-sm text-gray-600 dark:text-gray-400">
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
