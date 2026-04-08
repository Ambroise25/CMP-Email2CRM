import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import type { BienWithGestionnaire, PaginatedResponse } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
} from "lucide-react";

export default function BiensList() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const limit = 20;

  const queryKey = search
    ? ["/api/biens", `?page=${page}&limit=${limit}&search=${search}`]
    : ["/api/biens", `?page=${page}&limit=${limit}`];

  const { data, isLoading } = useQuery<PaginatedResponse<BienWithGestionnaire>>({
    queryKey,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

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

        <form onSubmit={handleSearch} className="mb-6">
          <div className="flex gap-2">
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
          </div>
        </form>

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
                    <div className="flex items-center justify-center h-10 w-10 rounded-md bg-primary/10 text-primary shrink-0">
                      <Building2 className="w-5 h-5" />
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
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          {bien.codePostal} {bien.ville}
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5" />
                          {bien.gestionnaire?.nom}
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
              {search ? "Aucun resultat pour cette recherche." : "Commencez par ajouter votre premier bien."}
            </p>
            {!search && (
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
