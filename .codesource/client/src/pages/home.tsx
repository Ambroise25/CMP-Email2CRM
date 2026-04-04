import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Loader2, Mail, RefreshCw, CheckCircle2, XCircle, Inbox,
  Sparkles, Paperclip, FileText, Image, ExternalLink,
  Play, Square, Clock, Send, AlertTriangle, Archive,
  ChevronDown, ChevronUp, Eye, Table2, Copy, BellRing
} from "lucide-react";

interface Contact {
  nom: string | null;
  telephone: string | null;
  email: string | null;
  qualite: string | null;
}

interface ParsedData {
  bien: {
    adresse: string | null;
    code_postal: string | null;
    ville: string | null;
    nom_copropriete: string | null;
  };
  demande: {
    objet: string | null;
    detail: string | null;
    metier: string;
    urgence: string;
    ref_syndic: string | null;
  };
  contacts: Contact[];
  codes_acces: string | null;
  syndic: string | null;
  gestionnaire: string | null;
  confiance: {
    bien: number;
    demande: number;
    contacts: number;
    codes_acces: number;
    syndic: number;
    global: number;
  };
  needs_review: boolean;
  tokens_used: number;
  pieces_jointes?: Array<{ nom: string; type: string; taille: number; chemin_local: string }>;
  url_sources?: Array<{ url: string; type: string }>;
  error?: string;
}

interface Demande {
  id: string;
  email_id: string;
  message_id: string;
  email_from: string;
  email_subject: string;
  email_date: string;
  parsed_at: string;
  parsed: ParsedData | null;
  is_forwarded: boolean;
  status: string;
  error?: string;
  crm_result?: unknown;
  archived?: boolean;
  archive_folder?: string | null;
  duplicate_type?: string | null;
  duplicate_of?: string | null;
}

interface DemandesResponse {
  success: boolean;
  demandes: Demande[];
  count: number;
}

interface PollingStatus {
  enabled: boolean;
  interval_seconds: number;
  last_check: string | null;
  next_check: string | null;
  emails_found: number;
  emails_parsed: number;
  is_processing: boolean;
  last_error: string | null;
}

export default function Home() {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const demandesQuery = useQuery<DemandesResponse>({
    queryKey: ["/api/demandes"],
    queryFn: async () => {
      const res = await fetch("/api/demandes");
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return res.json();
    },
    refetchInterval: 15000,
  });

  const pollingQuery = useQuery<PollingStatus>({
    queryKey: ["/api/polling/status"],
    queryFn: async () => {
      const res = await fetch("/api/polling/status");
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return res.json();
    },
    refetchInterval: 10000,
  });

  const fetchAndParseMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/emails/fetch-and-parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/demandes"] });
    }
  });

  const startPollingMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/polling/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval_seconds: 300 })
      });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/polling/status"] });
    }
  });

  const stopPollingMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/polling/stop", { method: "POST" });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/polling/status"] });
    }
  });

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const safeString = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    if (typeof value === "string") return value;
    if (typeof value === "object") {
      const obj = value as Record<string, unknown>;
      if ("syndic" in obj && typeof obj.syndic === "string") return obj.syndic;
      if ("nom" in obj && typeof obj.nom === "string") return obj.nom;
      return JSON.stringify(value);
    }
    return String(value);
  };

  const demandes = demandesQuery.data?.demandes || [];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Mail className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-xl font-semibold" data-testid="text-title">Email Parser</h1>
              <p className="text-xs text-muted-foreground">Email2Extranet</p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <Button
              onClick={() => fetchAndParseMutation.mutate()}
              disabled={fetchAndParseMutation.isPending || pollingQuery.data?.is_processing}
              data-testid="button-fetch-parse"
            >
              {fetchAndParseMutation.isPending || pollingQuery.data?.is_processing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Traitement...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Récupérer et parser
                </>
              )}
            </Button>

            {pollingQuery.data?.enabled ? (
              <Button
                onClick={() => stopPollingMutation.mutate()}
                disabled={stopPollingMutation.isPending}
                variant="destructive"
                size="sm"
                data-testid="button-stop-polling"
              >
                <Square className="mr-1 h-3 w-3" />
                Stop auto
              </Button>
            ) : (
              <Button
                onClick={() => startPollingMutation.mutate()}
                disabled={startPollingMutation.isPending}
                variant="outline"
                size="sm"
                data-testid="button-start-polling"
              >
                <Play className="mr-1 h-3 w-3" />
                Auto (5min)
              </Button>
            )}

            <Badge
              variant={pollingQuery.data?.enabled ? "default" : "secondary"}
              data-testid="badge-polling-status"
            >
              <Clock className="mr-1 h-3 w-3" />
              {pollingQuery.data?.enabled ? "Polling actif" : "Polling inactif"}
            </Badge>

            {pollingQuery.data?.is_processing && (
              <Badge variant="default" data-testid="badge-processing">
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                En cours...
              </Badge>
            )}

            <Badge variant="outline" data-testid="badge-demandes-count">
              <Table2 className="mr-1 h-3 w-3" />
              {demandes.length} demande(s)
            </Badge>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-4 py-4">
        {pollingQuery.data?.last_error && (
          <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 p-3 flex items-center gap-2" data-testid="error-polling">
            <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />
            <span className="text-sm text-destructive">{pollingQuery.data.last_error}</span>
          </div>
        )}

        {fetchAndParseMutation.isError && (
          <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 p-3 flex items-center gap-2" data-testid="error-fetch">
            <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />
            <span className="text-sm text-destructive">{fetchAndParseMutation.error?.message}</span>
          </div>
        )}

        {demandes.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Inbox className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-lg font-medium text-muted-foreground" data-testid="text-empty">Aucune demande parsée</p>
              <p className="text-sm text-muted-foreground mt-1">
                Cliquez sur "Récupérer et parser" pour traiter les emails non lus
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="border rounded-md overflow-hidden" data-testid="demandes-table">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Date</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Syndic</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Référence</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Objet</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Adresse</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">CP</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Ville</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Métier</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Urgence</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Confiance</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Statut</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {demandes.map((demande) => {
                    const p = demande.parsed;
                    const isExpanded = expandedRow === demande.id;
                    const confidence = p?.confiance?.global || 0;

                    return (
                      <TableRow
                        key={demande.id}
                        demande={demande}
                        p={p}
                        isExpanded={isExpanded}
                        confidence={confidence}
                        onToggle={() => setExpandedRow(isExpanded ? null : demande.id)}
                        formatDate={formatDate}
                        safeString={safeString}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function TableRow({
  demande,
  p,
  isExpanded,
  confidence,
  onToggle,
  formatDate,
  safeString,
}: {
  demande: Demande;
  p: ParsedData | null;
  isExpanded: boolean;
  confidence: number;
  onToggle: () => void;
  formatDate: (s: string) => string;
  safeString: (v: unknown) => string;
}) {
  if (demande.status === "error") {
    return (
      <>
        <tr className="border-b hover-elevate" data-testid={`row-demande-${demande.id}`}>
          <td className="px-3 py-2 text-xs whitespace-nowrap">{formatDate(demande.email_date)}</td>
          <td className="px-3 py-2" colSpan={9}>
            <span className="text-destructive text-xs">{demande.email_subject}</span>
          </td>
          <td className="px-3 py-2">
            <Badge variant="destructive">Erreur</Badge>
          </td>
          <td className="px-3 py-2">
            <Button size="icon" variant="ghost" onClick={onToggle} data-testid={`button-expand-${demande.id}`}>
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </td>
        </tr>
        {isExpanded && (
          <tr className="border-b bg-destructive/5">
            <td colSpan={12} className="px-4 py-3">
              <p className="text-sm text-destructive">{demande.error}</p>
              <p className="text-xs text-muted-foreground mt-1">Email: {demande.email_from}</p>
            </td>
          </tr>
        )}
      </>
    );
  }

  return (
    <>
      <tr
        className={`border-b hover-elevate cursor-pointer ${p?.needs_review ? 'bg-yellow-500/5' : ''}`}
        onClick={onToggle}
        data-testid={`row-demande-${demande.id}`}
      >
        <td className="px-3 py-2 text-xs whitespace-nowrap" data-testid={`cell-date-${demande.id}`}>
          {formatDate(demande.email_date)}
        </td>
        <td className="px-3 py-2 font-medium whitespace-nowrap max-w-[150px] truncate" data-testid={`cell-syndic-${demande.id}`}>
          {safeString(p?.syndic) || "-"}
        </td>
        <td className="px-3 py-2 text-xs whitespace-nowrap" data-testid={`cell-ref-${demande.id}`}>
          {p?.demande?.ref_syndic || "-"}
        </td>
        <td className="px-3 py-2 max-w-[250px] truncate" data-testid={`cell-objet-${demande.id}`}>
          {p?.demande?.objet || demande.email_subject || "-"}
        </td>
        <td className="px-3 py-2 max-w-[200px] truncate" data-testid={`cell-adresse-${demande.id}`}>
          {p?.bien?.adresse || "-"}
        </td>
        <td className="px-3 py-2 text-xs whitespace-nowrap" data-testid={`cell-cp-${demande.id}`}>
          {p?.bien?.code_postal || "-"}
        </td>
        <td className="px-3 py-2 whitespace-nowrap max-w-[120px] truncate" data-testid={`cell-ville-${demande.id}`}>
          {p?.bien?.ville || "-"}
        </td>
        <td className="px-3 py-2" data-testid={`cell-metier-${demande.id}`}>
          <Badge variant="secondary" className="text-xs">
            {p?.demande?.metier || "-"}
          </Badge>
        </td>
        <td className="px-3 py-2" data-testid={`cell-urgence-${demande.id}`}>
          <Badge
            variant={
              p?.demande?.urgence === "Urgent"
                ? "destructive"
                : p?.demande?.urgence === "Faible"
                  ? "outline"
                  : "secondary"
            }
            className="text-xs"
          >
            {p?.demande?.urgence || "-"}
          </Badge>
        </td>
        <td className="px-3 py-2" data-testid={`cell-confiance-${demande.id}`}>
          <Badge
            variant={confidence >= 0.7 ? "default" : confidence >= 0.5 ? "secondary" : "destructive"}
            className="text-xs"
          >
            {Math.round(confidence * 100)}%
          </Badge>
        </td>
        <td className="px-3 py-2" data-testid={`cell-status-${demande.id}`}>
          <div className="flex items-center gap-1">
            {p?.needs_review ? (
              <Badge variant="outline" className="text-xs gap-1">
                <AlertTriangle className="h-3 w-3" />
                Revue
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs gap-1">
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                OK
              </Badge>
            )}
            {demande.duplicate_type === "doublon" && (
              <Badge variant="outline" className="text-xs gap-1 border-orange-400 text-orange-600" data-testid={`badge-doublon-${demande.id}`}>
                <Copy className="h-3 w-3" />
                Doublon
              </Badge>
            )}
            {demande.duplicate_type === "relance" && (
              <Badge variant="destructive" className="text-xs gap-1" data-testid={`badge-relance-${demande.id}`}>
                <BellRing className="h-3 w-3" />
                Relance
              </Badge>
            )}
            {demande.archived && (
              <Archive className="h-3 w-3 text-muted-foreground" />
            )}
          </div>
        </td>
        <td className="px-3 py-2">
          <Button size="icon" variant="ghost" data-testid={`button-expand-${demande.id}`}>
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </td>
      </tr>

      {isExpanded && p && (
        <tr className="border-b bg-muted/30">
          <td colSpan={12} className="p-4">
            <ExpandedDetail demande={demande} p={p} safeString={safeString} />
          </td>
        </tr>
      )}
    </>
  );
}

function ExpandedDetail({
  demande,
  p,
  safeString,
}: {
  demande: Demande;
  p: ParsedData;
  safeString: (v: unknown) => string;
}) {
  const crmSendMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/crm/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parsed_data: p,
          email_date: demande.email_date,
          email_id: demande.email_id
        })
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/demandes"] });
    }
  });

  const unarchiveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/emails/${demande.email_id}/unarchive`, {
        method: "POST"
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/demandes"] });
    }
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4" data-testid={`detail-${demande.id}`}>
      <div className="space-y-3">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Demande</p>
          <dl className="space-y-1 text-sm">
            <div className="flex gap-2">
              <dt className="text-muted-foreground text-xs min-w-[60px]">Syndic</dt>
              <dd className="font-medium">{safeString(p.syndic) || "-"}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted-foreground text-xs min-w-[60px]">Réf</dt>
              <dd className="font-medium">{p.demande?.ref_syndic || "-"}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted-foreground text-xs min-w-[60px]">Objet</dt>
              <dd className="font-medium">{p.demande?.objet || "-"}</dd>
            </div>
            {p.demande?.detail && (
              <div className="flex gap-2">
                <dt className="text-muted-foreground text-xs min-w-[60px]">Détail</dt>
                <dd className="text-xs">{safeString(p.demande.detail)}</dd>
              </div>
            )}
          </dl>
        </div>

        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Lieu d'intervention</p>
          <dl className="space-y-1 text-sm">
            <div className="flex gap-2">
              <dt className="text-muted-foreground text-xs min-w-[60px]">Adresse</dt>
              <dd className="font-medium">
                {p.bien?.adresse ? (
                  <a
                    href={`https://earth.google.com/web/search/${encodeURIComponent(`${p.bien.adresse}, ${p.bien.code_postal} ${p.bien.ville}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1"
                    data-testid={`link-earth-${demande.id}`}
                  >
                    {p.bien.adresse}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : "-"}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted-foreground text-xs min-w-[60px]">CP / Ville</dt>
              <dd className="font-medium">{p.bien?.code_postal || "-"} {p.bien?.ville || ""}</dd>
            </div>
            {p.bien?.nom_copropriete && (
              <div className="flex gap-2">
                <dt className="text-muted-foreground text-xs min-w-[60px]">Copro</dt>
                <dd className="font-medium">{p.bien.nom_copropriete}</dd>
              </div>
            )}
          </dl>
        </div>

        {p.codes_acces && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Accès</p>
            <p className="text-sm">{safeString(p.codes_acces)}</p>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Contacts</p>
          {p.gestionnaire && (
            <div className="bg-background rounded-md p-2 mb-2 text-sm">
              <p className="text-xs text-muted-foreground">Gestionnaire</p>
              <p className="font-medium">{safeString(p.gestionnaire)}</p>
            </div>
          )}
          {p.contacts && p.contacts.length > 0 ? (
            <div className="space-y-2">
              {p.contacts.map((contact, idx) => (
                <div key={idx} className="bg-background rounded-md p-2 text-sm" data-testid={`contact-${demande.id}-${idx}`}>
                  <p className="text-xs text-muted-foreground capitalize">{contact.qualite || "Contact"}</p>
                  <p className="font-medium">{contact.nom || "-"}</p>
                  {contact.telephone && <p className="text-xs text-muted-foreground">{contact.telephone}</p>}
                  {contact.email && <p className="text-xs text-muted-foreground">{contact.email}</p>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Aucun contact</p>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Email source</p>
          <dl className="space-y-1 text-xs">
            <div className="flex gap-2">
              <dt className="text-muted-foreground min-w-[30px]">De</dt>
              <dd className="truncate">{demande.email_from}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted-foreground min-w-[30px]">Sujet</dt>
              <dd className="truncate">{demande.email_subject}</dd>
            </div>
          </dl>
          <div className="flex flex-wrap gap-1 mt-1">
            {demande.duplicate_type === "doublon" && (
              <Badge variant="outline" className="text-xs border-orange-400 text-orange-600" data-testid={`badge-detail-doublon-${demande.id}`}>
                <Copy className="h-3 w-3 mr-1" />
                Doublon (même OS)
              </Badge>
            )}
            {demande.duplicate_type === "relance" && (
              <Badge variant="destructive" className="text-xs" data-testid={`badge-detail-relance-${demande.id}`}>
                <BellRing className="h-3 w-3 mr-1" />
                Relance (urgence augmentée)
              </Badge>
            )}
            {demande.is_forwarded && (
              <Badge variant="outline" className="text-xs">Transféré</Badge>
            )}
            {demande.archived ? (
              <Badge variant="secondary" className="text-xs" data-testid={`badge-archived-${demande.id}`}>
                <Archive className="h-3 w-3 mr-1" />
                Archivé
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs text-muted-foreground" data-testid={`badge-inbox-${demande.id}`}>
                <Inbox className="h-3 w-3 mr-1" />
                Boîte de réception
              </Badge>
            )}
          </div>
          {demande.archived && (
            <Button
              variant="outline"
              size="sm"
              className="mt-1"
              onClick={(e) => {
                e.stopPropagation();
                unarchiveMutation.mutate();
              }}
              disabled={unarchiveMutation.isPending}
              data-testid={`button-unarchive-${demande.id}`}
            >
              {unarchiveMutation.isPending ? (
                <>
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  Désarchivage...
                </>
              ) : (
                <>
                  <Inbox className="mr-1 h-3 w-3" />
                  Désarchiver
                </>
              )}
            </Button>
          )}
          {unarchiveMutation.isSuccess && unarchiveMutation.data && (
            <div className="mt-1 text-xs">
              {unarchiveMutation.data.success ? (
                <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>{unarchiveMutation.data.message || "Désarchivé"}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-destructive">
                  <XCircle className="h-3 w-3" />
                  <span>{unarchiveMutation.data.error || "Erreur"}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {p.pieces_jointes && p.pieces_jointes.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1">
              <Paperclip className="h-3 w-3" />
              PJ ({p.pieces_jointes.length})
            </p>
            <div className="space-y-1">
              {p.pieces_jointes.map((pj, idx) => (
                <div key={idx} className="flex items-center gap-1 text-xs bg-background rounded px-2 py-1">
                  {pj.type?.startsWith('image/') ? (
                    <Image className="h-3 w-3 text-muted-foreground" />
                  ) : (
                    <FileText className="h-3 w-3 text-muted-foreground" />
                  )}
                  <span className="truncate">{pj.nom}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {p.url_sources && p.url_sources.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1">
              <ExternalLink className="h-3 w-3" />
              URLs ({p.url_sources.length})
            </p>
            <div className="space-y-1">
              {p.url_sources.map((source, idx) => (
                <a
                  key={idx}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-xs text-primary hover:underline truncate"
                >
                  {source.url}
                </a>
              ))}
            </div>
          </div>
        )}

        <div className="pt-2 border-t">
          <Button
            onClick={(e) => {
              e.stopPropagation();
              crmSendMutation.mutate();
            }}
            disabled={crmSendMutation.isPending || !p.bien?.adresse}
            size="sm"
            data-testid={`button-crm-${demande.id}`}
          >
            {crmSendMutation.isPending ? (
              <>
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                Envoi...
              </>
            ) : (
              <>
                <Send className="mr-1 h-3 w-3" />
                Envoyer au CRM
              </>
            )}
          </Button>
          {!p.bien?.adresse && (
            <p className="text-xs text-muted-foreground mt-1">Adresse manquante</p>
          )}
          {crmSendMutation.isSuccess && crmSendMutation.data && (
            <div className="mt-2 text-xs">
              {crmSendMutation.data.success ? (
                <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>{crmSendMutation.data.message || "Envoyé"}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-destructive">
                  <XCircle className="h-3 w-3" />
                  <span>{crmSendMutation.data.error || "Erreur"}</span>
                </div>
              )}
            </div>
          )}
          {crmSendMutation.isError && (
            <div className="mt-2 flex items-center gap-1 text-xs text-destructive">
              <XCircle className="h-3 w-3" />
              Erreur connexion CRM
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
