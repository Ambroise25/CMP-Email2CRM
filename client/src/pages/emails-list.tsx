import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import type { DemandeWithRelations, EmailLog, PaginatedResponse } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  User,
  AlertTriangle,
  FileText,
  ExternalLink,
  CheckCircle,
  XCircle,
  MinusCircle,
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

function formatDate(dateStr: string | Date) {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDateTime(dateStr: string | Date) {
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

interface ParsedData {
  bien?: { adresse?: string; code_postal?: string; ville?: string; nom_copropriete?: string } | null;
  demande?: { objet?: string; detail?: string; metier?: string; urgence?: string; ref_syndic?: string } | null;
  contacts?: Array<{ nom?: string; telephone?: string; email?: string; qualite?: string }>;
  codes_acces?: string | null;
  gestionnaire?: string | null;
  syndic?: string | null;
  confiance?: number;
}

function EmailDetailModal({ email, onClose }: { email: EmailLog; onClose: () => void }) {
  let parsed: ParsedData | null = null;
  try {
    if (email.rawParsed) {
      parsed = JSON.parse(email.rawParsed);
    }
  } catch {}

  const urgenceColors: Record<string, string> = {
    Urgent: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    Normal: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    Faible: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-blue-600" />
            Détail de l'email
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <User className="h-3 w-3" />
                Expéditeur
              </p>
              <p className="text-sm font-medium break-all" data-testid="modal-email-from">{email.from}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Date de réception
              </p>
              <p className="text-sm font-medium" data-testid="modal-email-date">
                {formatDateTime(email.receivedAt as unknown as string)}
              </p>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Sujet</p>
            <p className="text-sm font-semibold" data-testid="modal-email-subject">{email.subject}</p>
          </div>

          <div className="flex items-center gap-2">
            <Badge className={`text-xs ${statutColors[email.statut] ?? ""}`} data-testid="modal-email-statut">
              {statutLabels[email.statut] ?? email.statut}
            </Badge>
            {email.demandeId && (
              <Link href={`/demandes/${email.demandeId}`}>
                <Button variant="outline" size="sm" data-testid="modal-link-demande">
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                  Voir la demande #{email.demandeId}
                </Button>
              </Link>
            )}
          </div>

          {email.erreur && (
            <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950 rounded-md text-sm text-red-700 dark:text-red-300" data-testid="modal-email-error">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{email.erreur}</span>
            </div>
          )}

          {email.body && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <FileText className="h-3 w-3" />
                Corps du message
              </p>
              <div
                className="text-sm text-foreground whitespace-pre-wrap bg-muted/40 rounded-md p-3 max-h-48 overflow-y-auto font-mono text-xs"
                data-testid="modal-email-body"
              >
                {email.body}
              </div>
            </div>
          )}

          {parsed && (
            <div className="border-t pt-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Données extraites par l'IA
              </p>

              {parsed.demande && (
                <div className="space-y-2">
                  {parsed.demande.objet && (
                    <div>
                      <p className="text-xs text-muted-foreground">Objet</p>
                      <p className="text-sm font-medium" data-testid="modal-parsed-objet">{parsed.demande.objet}</p>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {parsed.demande.metier && (
                      <Badge variant="secondary" className="text-xs" data-testid="modal-parsed-metier">
                        {parsed.demande.metier}
                      </Badge>
                    )}
                    {parsed.demande.urgence && (
                      <Badge className={`text-xs ${urgenceColors[parsed.demande.urgence] ?? ""}`} data-testid="modal-parsed-urgence">
                        {parsed.demande.urgence}
                      </Badge>
                    )}
                    {parsed.demande.ref_syndic && (
                      <Badge variant="outline" className="text-xs" data-testid="modal-parsed-ref">
                        Réf: {parsed.demande.ref_syndic}
                      </Badge>
                    )}
                  </div>
                  {parsed.demande.detail && (
                    <div>
                      <p className="text-xs text-muted-foreground">Détail</p>
                      <p className="text-sm text-foreground" data-testid="modal-parsed-detail">{parsed.demande.detail}</p>
                    </div>
                  )}
                </div>
              )}

              {parsed.bien && (
                <div>
                  <p className="text-xs text-muted-foreground">Bien</p>
                  <p className="text-sm" data-testid="modal-parsed-bien">
                    {[parsed.bien.adresse, parsed.bien.code_postal, parsed.bien.ville].filter(Boolean).join(", ")}
                    {parsed.bien.nom_copropriete && ` (${parsed.bien.nom_copropriete})`}
                  </p>
                </div>
              )}

              {parsed.syndic && (
                <div>
                  <p className="text-xs text-muted-foreground">Syndic</p>
                  <p className="text-sm" data-testid="modal-parsed-syndic">{parsed.syndic}</p>
                </div>
              )}

              {parsed.gestionnaire && (
                <div>
                  <p className="text-xs text-muted-foreground">Gestionnaire</p>
                  <p className="text-sm" data-testid="modal-parsed-gestionnaire">{parsed.gestionnaire}</p>
                </div>
              )}

              {parsed.contacts && parsed.contacts.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Contacts</p>
                  <div className="space-y-1">
                    {parsed.contacts.map((c, i) => (
                      <p key={i} className="text-sm" data-testid={`modal-parsed-contact-${i}`}>
                        {[c.nom, c.qualite, c.telephone, c.email].filter(Boolean).join(" · ")}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {parsed.codes_acces && (
                <div>
                  <p className="text-xs text-muted-foreground">Codes d'accès</p>
                  <p className="text-sm font-mono" data-testid="modal-parsed-codes">{parsed.codes_acces}</p>
                </div>
              )}

              {parsed.confiance !== undefined && (
                <div>
                  <p className="text-xs text-muted-foreground">Confiance IA</p>
                  <p className="text-sm" data-testid="modal-parsed-confiance">{Math.round(parsed.confiance * 100)}%</p>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function EmailsList() {
  const [page, setPage] = useState(1);
  const [emailPage, setEmailPage] = useState(1);
  const [selectedEmail, setSelectedEmail] = useState<EmailLog | null>(null);
  const limit = 20;
  const emailLimit = 10;
  const { toast } = useToast();

  const { data, isLoading } = useQuery<PaginatedResponse<DemandeWithRelations>>({
    queryKey: ["/api/demandes", "nouvelle", page],
    queryFn: () =>
      fetch(`/api/demandes?etat=nouvelle&page=${page}&limit=${limit}`).then((r) => r.json()),
  });

  const { data: emailData, isLoading: emailsLoading } = useQuery<PaginatedResponse<EmailLog>>({
    queryKey: ["/api/emails/logs", emailPage],
    queryFn: () =>
      fetch(`/api/emails/logs?page=${emailPage}&limit=${emailLimit}&statut=traite,erreur`).then((r) => r.json()),
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
      queryClient.invalidateQueries({ queryKey: ["/api/emails/logs"] });
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
  const emails = emailData?.data ?? [];
  const emailPagination = emailData?.pagination;

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

        {/* Historique des emails traités — Task #3: email detail modal */}
        <div className="mt-10">
          <h2 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            Historique des emails traités
          </h2>
          <div className="space-y-2">
            {emailsLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="p-3">
                  <Skeleton className="h-4 w-3/4 mb-1" />
                  <Skeleton className="h-3 w-1/2" />
                </Card>
              ))
            ) : emails.length === 0 ? (
              <Card className="p-8 text-center">
                <Mail className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Aucun email traité pour l'instant</p>
              </Card>
            ) : (
              emails.map((email) => {
                const StatutIcon = statutIcons[email.statut] ?? MinusCircle;
                return (
                  <Card
                    key={email.id}
                    className="p-3 hover:shadow-sm transition-shadow cursor-pointer"
                    data-testid={`card-email-${email.id}`}
                    onClick={() => setSelectedEmail(email)}
                  >
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2 min-w-0">
                        <StatutIcon
                          className={`h-4 w-4 flex-shrink-0 ${
                            email.statut === "traite"
                              ? "text-green-500"
                              : email.statut === "erreur"
                              ? "text-red-500"
                              : "text-gray-400"
                          }`}
                        />
                        <div className="min-w-0">
                          <p
                            className="text-sm font-medium text-foreground truncate"
                            data-testid={`text-subject-${email.id}`}
                          >
                            {email.subject}
                          </p>
                          <p
                            className="text-xs text-muted-foreground truncate"
                            data-testid={`text-from-${email.id}`}
                          >
                            {email.from}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge
                          className={`text-xs ${statutColors[email.statut] ?? ""}`}
                          data-testid={`status-email-${email.id}`}
                        >
                          {statutLabels[email.statut] ?? email.statut}
                        </Badge>
                        {email.demandeId && (
                          <span
                            className="text-xs text-blue-600 dark:text-blue-400 font-medium"
                            data-testid={`link-demande-${email.id}`}
                          >
                            Demande #{email.demandeId}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground" data-testid={`text-date-${email.id}`}>
                          {formatDate(email.receivedAt as unknown as string)}
                        </span>
                      </div>
                    </div>
                  </Card>
                );
              })
            )}
          </div>

          {emailPagination && emailPagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-muted-foreground">
                {emailPagination.total} email(s)
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEmailPage((p) => Math.max(1, p - 1))}
                  disabled={emailPage === 1}
                  data-testid="button-prev-email-page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground">
                  {emailPage} / {emailPagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEmailPage((p) => Math.min(emailPagination.totalPages, p + 1))}
                  disabled={emailPage === emailPagination.totalPages}
                  data-testid="button-next-email-page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedEmail && (
        <EmailDetailModal email={selectedEmail} onClose={() => setSelectedEmail(null)} />
      )}
    </div>
  );
}
