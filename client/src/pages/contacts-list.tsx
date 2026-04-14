import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import type { ContactWithDemande, PaginatedResponse } from "@shared/schema";
import { CONTACT_QUALITES, contactQualiteLabels } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  ChevronLeft,
  ChevronRight,
  Phone,
  Mail,
  ExternalLink,
  Search,
} from "lucide-react";

const FILTER_QUALITES = [
  { value: "", label: "Tous" },
  { value: "gestionnaire", label: "Gestionnaire (syndic)" },
  { value: "proprietaire", label: "Propriétaire" },
  { value: "locataire", label: "Locataire occupant" },
  { value: "conseil_syndical", label: "Conseil syndical" },
] as const;

const qualiteBadgeColors: Record<string, string> = {
  gestionnaire: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  proprietaire: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  locataire: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  conseil_syndical: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  gardien: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  autre: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

export default function ContactsList() {
  const [page, setPage] = useState(1);
  const [qualiteFilter, setQualiteFilter] = useState<string>("");
  const [searchValue, setSearchValue] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const limit = 20;

  let queryString = `?page=${page}&limit=${limit}`;
  if (qualiteFilter) queryString += `&qualite=${qualiteFilter}`;
  if (searchQuery) queryString += `&search=${encodeURIComponent(searchQuery)}`;

  const { data, isLoading } = useQuery<PaginatedResponse<ContactWithDemande>>({
    queryKey: ["/api/contacts", queryString],
  });

  const handleFilterChange = (val: string) => {
    setQualiteFilter(val);
    setPage(1);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(searchValue);
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-8">

        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-md bg-primary/10 text-primary">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-foreground" data-testid="text-page-title">
                Contacts
              </h1>
              <p className="text-sm text-muted-foreground">
                {data
                  ? `${data.pagination.total} contact${data.pagination.total > 1 ? "s" : ""}`
                  : "Chargement..."}
              </p>
            </div>
          </div>
          <Link href="/">
            <Button variant="ghost" size="sm" data-testid="link-back-home">
              <ChevronLeft className="w-4 h-4 mr-1" />
              Accueil
            </Button>
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          {FILTER_QUALITES.map(({ value, label }) => (
            <Button
              key={value}
              variant={qualiteFilter === value ? "default" : "outline"}
              size="sm"
              onClick={() => handleFilterChange(value)}
              data-testid={`button-filter-${value || "tous"}`}
            >
              {label}
            </Button>
          ))}
        </div>

        <form onSubmit={handleSearch} className="flex items-center gap-2 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par nom ou téléphone..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="pl-9"
              data-testid="input-search-contacts"
            />
          </div>
          <Button type="submit" size="sm" data-testid="button-search-submit">
            Rechercher
          </Button>
          {searchQuery && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchValue("");
                setSearchQuery("");
                setPage(1);
              }}
              data-testid="button-search-clear"
            >
              Effacer
            </Button>
          )}
        </form>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} className="p-4">
                <div className="flex items-start gap-4">
                  <Skeleton className="h-10 w-10 rounded-md" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-1/2" />
                    <Skeleton className="h-4 w-1/3" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : data && data.data.length > 0 ? (
          <div className="space-y-3">
            {data.data.map((contact) => (
              <Card
                key={contact.id}
                className="p-4"
                data-testid={`card-contact-${contact.id}`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex items-center justify-center h-10 w-10 rounded-md bg-primary/10 text-primary shrink-0">
                    <Users className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span
                        className="font-medium text-foreground"
                        data-testid={`text-nom-${contact.id}`}
                      >
                        {contact.nom || <span className="text-muted-foreground italic">Sans nom</span>}
                      </span>
                      <Badge
                        className={qualiteBadgeColors[contact.qualite] || qualiteBadgeColors.autre}
                        data-testid={`badge-qualite-${contact.id}`}
                      >
                        {contactQualiteLabels[contact.qualite as keyof typeof contactQualiteLabels] || contact.qualite}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      {contact.telephone && (
                        <span className="flex items-center gap-1" data-testid={`text-telephone-${contact.id}`}>
                          <Phone className="w-3.5 h-3.5" />
                          {contact.telephone}
                        </span>
                      )}
                      {contact.email && (
                        <span className="flex items-center gap-1" data-testid={`text-email-${contact.id}`}>
                          <Mail className="w-3.5 h-3.5" />
                          {contact.email}
                        </span>
                      )}
                      {contact.demande && (
                        <Link href={`/demandes/${contact.demandeId}`}>
                          <span
                            className="flex items-center gap-1 text-primary hover:underline cursor-pointer"
                            data-testid={`link-demande-${contact.id}`}
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Demande #{contact.demandeId}
                          </span>
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-1" data-testid="text-empty-title">
              Aucun contact trouvé
            </h3>
            <p className="text-muted-foreground">
              {qualiteFilter || searchQuery
                ? "Aucun résultat pour ces critères."
                : "Les contacts extraits des emails apparaîtront ici."}
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
