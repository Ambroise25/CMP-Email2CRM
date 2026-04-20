import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import type { DemandeWithRelations, Document, Gestionnaire, EmailLog } from "@shared/schema";
import { etatLabels, contactQualiteLabels } from "@shared/schema";
import { GestionnaireCombobox } from "@/components/gestionnaire-combobox";
import { Card } from "@/components/ui/card";
import { AdresseLink } from "@/components/AdresseLink";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  ClipboardList,
  Building2,
  User,
  Calendar,
  Wrench,
  ArrowLeft,
  Pencil,
  Hash,
  Mail,
  Phone,
  MapPin,
  FileText,
  MessageSquare,
  Tag,
  Zap,
  Paperclip,
  Upload,
  Download,
  Trash2,
  File,
  Image,
  AlertTriangle,
  Save,
  Inbox,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

type DocumentMeta = Omit<Document, "data"> & { size: number };

const qualiteBadgeColors: Record<string, string> = {
  gestionnaire: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  proprietaire: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  locataire: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  conseil_syndical: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  gardien: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  autre: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

const etatColors: Record<string, string> = {
  nouvelle: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  a_contacter: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  en_attente_retour: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  programmee: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  terminee: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  annulee: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

function formatDocDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  } as Intl.DateTimeFormatOptions);
}

function formatFileSize(sizeBytes: number): string {
  if (sizeBytes < 1024) return `${sizeBytes} o`;
  if (sizeBytes < 1024 * 1024) return `${Math.round(sizeBytes / 1024)} Ko`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return Image;
  return File;
}

function DocumentsSection({ demandeId }: { demandeId: number }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const { data: docs = [], isLoading } = useQuery<DocumentMeta[]>({
    queryKey: ["/api/demandes", demandeId, "documents"],
    queryFn: () => fetch(`/api/demandes/${demandeId}/documents`).then((r) => r.json()),
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      return new Promise<void>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const base64 = (reader.result as string).split(",")[1];
            await apiRequest("POST", `/api/demandes/${demandeId}/documents`, {
              nom: file.name,
              mimeType: file.type || "application/octet-stream",
              data: base64,
            });
            resolve();
          } catch (err) {
            reject(err);
          }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/demandes", demandeId, "documents"] });
      toast({ title: "Document ajouté", description: "Le fichier a été téléversé avec succès." });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de téléverser le fichier.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (docId: number) => apiRequest("DELETE", `/api/documents/${docId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/demandes", demandeId, "documents"] });
      toast({ title: "Document supprimé" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de supprimer le document.", variant: "destructive" });
    },
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      uploadMutation.mutate(file);
      e.target.value = "";
    }
  }

  function handleDownload(doc: DocumentMeta) {
    const link = document.createElement("a");
    link.href = `/api/documents/${doc.id}/download`;
    link.download = doc.nom;
    link.click();
  }

  return (
    <Card className="p-6 mt-4" data-testid="card-documents">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <Paperclip className="w-3.5 h-3.5" />
          Documents
          {docs.length > 0 && (
            <Badge variant="secondary" className="ml-1 text-xs normal-case tracking-normal">
              {docs.length}
            </Badge>
          )}
        </h2>
        <Button
          size="sm"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadMutation.isPending}
          data-testid="button-upload-document"
        >
          <Upload className="w-3.5 h-3.5 mr-1.5" />
          {uploadMutation.isPending ? "En cours..." : "Ajouter un fichier"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
          onChange={handleFileChange}
          data-testid="input-file-upload"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : docs.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Paperclip className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm" data-testid="text-no-documents">Aucun document joint</p>
          <p className="text-xs mt-1">Cliquez sur "Ajouter un fichier" pour joindre un PDF, une image, etc.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map((doc) => {
            const FileIcon = getFileIcon(doc.mimeType);
            return (
              <div
                key={doc.id}
                className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors"
                data-testid={`row-document-${doc.id}`}
              >
                <FileIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-medium truncate"
                    data-testid={`text-doc-name-${doc.id}`}
                  >
                    {doc.nom}
                  </p>
                  <p className="text-xs text-muted-foreground" data-testid={`text-doc-meta-${doc.id}`}>
                    {doc.mimeType} · {formatFileSize(doc.size)} · {formatDocDate(doc.createdAt as unknown as string)}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownload(doc)}
                    data-testid={`button-download-doc-${doc.id}`}
                    title="Télécharger"
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteMutation.mutate(doc.id)}
                    disabled={deleteMutation.isPending}
                    data-testid={`button-delete-doc-${doc.id}`}
                    title="Supprimer"
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

export default function DemandeDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [selectedGestionnaireId, setSelectedGestionnaireId] = useState<number | null>(null);
  const [emailBodyExpanded, setEmailBodyExpanded] = useState(false);

  const { data: demande, isLoading, error } = useQuery<DemandeWithRelations>({
    queryKey: ["/api/demandes", id],
  });

  const { data: gestionnaires = [] } = useQuery<Gestionnaire[]>({
    queryKey: ["/api/gestionnaires"],
  });

  const { data: emailSource } = useQuery<EmailLog | null>({
    queryKey: ["/api/demandes", id, "email"],
    queryFn: () =>
      fetch(`/api/demandes/${id}/email`).then((r) =>
        r.status === 404 ? null : r.json()
      ),
    enabled: !!id,
  });

  const reassignMutation = useMutation({
    mutationFn: (gestionnaireId: number) =>
      apiRequest("PUT", `/api/demandes/${id}`, { gestionnaireId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/demandes", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/demandes"] });
      setSelectedGestionnaireId(null);
      toast({ title: "Gestionnaire assigné", description: "Le gestionnaire a été enregistré avec succès." });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible d'assigner le gestionnaire.", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <Skeleton className="h-8 w-32 mb-8" />
          <Card className="p-6 space-y-6">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-20 w-full" />
          </Card>
        </div>
      </div>
    );
  }

  if (error || !demande) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <Card className="p-12 text-center">
            <ClipboardList className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-1" data-testid="text-not-found">Demande non trouvee</h3>
            <p className="text-muted-foreground mb-4">
              Cette demande n'existe pas ou a ete supprimee.
            </p>
            <Link href="/demandes">
              <Button variant="outline" data-testid="button-back-list">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Retour a la liste
              </Button>
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <Link href="/demandes">
            <Button variant="ghost" data-testid="button-back">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour
            </Button>
          </Link>
          <Link href={`/demandes/${demande.id}/edit`}>
            <Button data-testid="button-edit-demande">
              <Pencil className="w-4 h-4 mr-2" />
              Modifier
            </Button>
          </Link>
        </div>

        {demande.infoManquantes && (
          <div
            className="flex items-start gap-3 p-4 mb-4 rounded-lg bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 text-orange-800 dark:text-orange-200"
            data-testid="alert-info-manquantes"
          >
            <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5 text-orange-500" />
            <div>
              <p className="font-semibold text-sm">Informations manquantes</p>
              <p className="text-sm mt-0.5">
                Les champs suivants sont à compléter : <span className="font-medium">{demande.champsManquants}</span>
              </p>
            </div>
          </div>
        )}

        <Card className="p-6" data-testid="card-demande-detail">
          <div className="flex items-start gap-4 mb-6">
            <div className="flex items-center justify-center h-12 w-12 rounded-md bg-primary/10 text-primary shrink-0">
              <ClipboardList className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-xl font-semibold text-foreground" data-testid="text-demande-objet">
                  {demande.objet}
                </h1>
                <Badge variant="outline" data-testid="text-demande-id">
                  <Hash className="w-3 h-3 mr-1" />
                  {demande.id}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <Badge
                  className={etatColors[demande.etat] || ""}
                  data-testid="badge-etat"
                >
                  {etatLabels[demande.etat as keyof typeof etatLabels] || demande.etat}
                </Badge>
                <Badge variant="secondary" data-testid="badge-metier">
                  <Wrench className="w-3 h-3 mr-1" />
                  {demande.metier}
                </Badge>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                Date demande client
              </p>
              <p className="font-medium" data-testid="text-date-demande">
                {new Date(demande.dateDemandeClient).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                Date de creation
              </p>
              <p className="font-medium" data-testid="text-created">
                {new Date(demande.createdAt).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>

            {demande.refSyndic && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5" />
                  Reference syndic
                </p>
                <p className="font-medium" data-testid="text-ref-syndic">
                  {demande.refSyndic}
                </p>
              </div>
            )}

            <div className="space-y-1">
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" />
                Travaux Enerpur
              </p>
              <p className="font-medium" data-testid="text-travaux-enerpur">
                {demande.travauxEnerpur ? "Oui" : "Non"}
              </p>
            </div>
          </div>

          {demande.detail && (
            <div className="mt-6 pt-6 border-t">
              <p className="text-sm text-muted-foreground flex items-center gap-1.5 mb-2">
                <FileText className="w-3.5 h-3.5" />
                Detail
              </p>
              <p className="text-foreground" data-testid="text-detail">
                {demande.detail}
              </p>
            </div>
          )}

          {demande.commentaire && (
            <div className="mt-6 pt-6 border-t">
              <p className="text-sm text-muted-foreground flex items-center gap-1.5 mb-2">
                <MessageSquare className="w-3.5 h-3.5" />
                Commentaire
              </p>
              <p className="text-foreground" data-testid="text-commentaire">
                {demande.commentaire}
              </p>
            </div>
          )}
        </Card>

        {demande.bien && (
          <Card className="p-6 mt-4" data-testid="card-bien">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-4 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" />
              Bien associe
            </h2>
            <Link href={`/biens/${demande.bien.id}`}>
              <div className="space-y-2 hover:bg-muted/50 rounded-md p-2 -m-2 transition-colors cursor-pointer">
                <p className="font-medium text-foreground" data-testid="text-bien-adresse">
                  {demande.bien.adresse}
                </p>
                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  <AdresseLink
                    adresse={`${demande.bien.adresse} ${demande.bien.codePostal} ${demande.bien.ville}`}
                    codePostal=""
                    ville=""
                  />
                </p>
              </div>
            </Link>
          </Card>
        )}

        {demande.gestionnaire ? (
          <Card className="p-6 mt-4" data-testid="card-gestionnaire">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-4 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />
              Gestionnaire
            </h2>
            <div className="space-y-3">
              <p className="font-medium text-foreground" data-testid="text-gestionnaire-nom">
                {demande.gestionnaire.nom}
              </p>
              {demande.gestionnaire.email && (
                <p className="text-sm text-muted-foreground flex items-center gap-1.5" data-testid="text-gestionnaire-email">
                  <Mail className="w-3.5 h-3.5" />
                  {demande.gestionnaire.email}
                </p>
              )}
              {demande.gestionnaire.telephone && (
                <p className="text-sm text-muted-foreground flex items-center gap-1.5" data-testid="text-gestionnaire-tel">
                  <Phone className="w-3.5 h-3.5" />
                  {demande.gestionnaire.telephone}
                </p>
              )}
            </div>
          </Card>
        ) : (
          <Card className="p-6 mt-4" data-testid="card-assign-gestionnaire">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-4 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />
              Gestionnaire
            </h2>
            <p className="text-sm text-muted-foreground mb-4 italic" data-testid="text-no-gestionnaire">
              Aucun gestionnaire assigné à cette demande.
            </p>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <GestionnaireCombobox
                  value={selectedGestionnaireId}
                  onChange={setSelectedGestionnaireId}
                  gestionnaires={gestionnaires}
                  data-testid="combobox-assign-gestionnaire"
                />
              </div>
              <Button
                onClick={() => selectedGestionnaireId && reassignMutation.mutate(selectedGestionnaireId)}
                disabled={!selectedGestionnaireId || reassignMutation.isPending}
                data-testid="button-save-gestionnaire"
              >
                <Save className="w-4 h-4 mr-2" />
                {reassignMutation.isPending ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </div>
          </Card>
        )}

        <Card className="p-6 mt-4" data-testid="card-contacts">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-4 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5" />
            Contacts
            {(demande.contacts ?? []).length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs normal-case tracking-normal">
                {(demande.contacts ?? []).length}
              </Badge>
            )}
          </h2>
          {(demande.contacts ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground italic" data-testid="text-no-contacts">
              Aucun contact identifié pour cette demande.
            </p>
          ) : (
            <div className="space-y-3">
              {(demande.contacts ?? []).map((contact) => (
                <div
                  key={contact.id}
                  className="flex flex-col gap-1"
                  data-testid={`row-contact-${contact.id}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground" data-testid={`text-contact-nom-${contact.id}`}>
                      {contact.nom || <span className="text-muted-foreground italic">Sans nom</span>}
                    </span>
                    <Badge
                      className={qualiteBadgeColors[contact.qualite] || qualiteBadgeColors.autre}
                      data-testid={`badge-contact-qualite-${contact.id}`}
                    >
                      {contactQualiteLabels[contact.qualite as keyof typeof contactQualiteLabels] || contact.qualite}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    {contact.telephone && (
                      <span className="flex items-center gap-1" data-testid={`text-contact-telephone-${contact.id}`}>
                        <Phone className="w-3.5 h-3.5" />
                        {contact.telephone}
                      </span>
                    )}
                    {contact.email && (
                      <span className="flex items-center gap-1" data-testid={`text-contact-email-${contact.id}`}>
                        <Mail className="w-3.5 h-3.5" />
                        {contact.email}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <DocumentsSection demandeId={demande.id} />

        {/* Email source card */}
        <Card className="p-6" data-testid="card-email-source">
          <div className="flex items-center gap-2 mb-4">
            <Inbox className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-base font-semibold text-foreground">Email source</h2>
            {emailSource && (
              <Badge
                className={
                  emailSource.statut === "traite"
                    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                    : emailSource.statut === "erreur"
                    ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                    : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                }
                data-testid="badge-email-statut"
              >
                {emailSource.statut}
              </Badge>
            )}
          </div>

          {emailSource === undefined ? (
            <div className="text-muted-foreground text-sm">Chargement…</div>
          ) : emailSource === null ? (
            <p className="text-muted-foreground text-sm italic" data-testid="text-email-none">
              Demande créée manuellement
            </p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start gap-2 text-sm" data-testid="text-email-from">
                <Mail className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <span className="text-foreground">{emailSource.from}</span>
              </div>
              <div className="flex items-start gap-2 text-sm" data-testid="text-email-subject">
                <Tag className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <span className="font-semibold text-foreground">{emailSource.subject}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="text-email-received-at">
                <Calendar className="w-4 h-4 shrink-0" />
                <span>
                  {new Date(emailSource.receivedAt).toLocaleString("fr-FR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              {emailSource.body && (
                <div className="mt-3">
                  <div
                    className={`bg-muted/50 rounded-md p-3 text-xs font-mono whitespace-pre-wrap overflow-y-auto transition-all ${
                      emailBodyExpanded ? "max-h-none" : "max-h-64"
                    }`}
                    data-testid="text-email-body"
                  >
                    {emailSource.body}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-1 text-xs text-muted-foreground"
                    onClick={() => setEmailBodyExpanded((v) => !v)}
                    data-testid="button-toggle-email-body"
                  >
                    {emailBodyExpanded ? (
                      <>
                        <ChevronUp className="w-3.5 h-3.5 mr-1" />
                        Voir moins
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-3.5 h-3.5 mr-1" />
                        Voir plus
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
