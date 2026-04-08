import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import BiensList from "@/pages/biens-list";
import BienDetail from "@/pages/bien-detail";
import BienForm from "@/pages/bien-form";
import BienSearch from "@/pages/bien-search";
import DemandesList from "@/pages/demandes-list";
import DemandeDetail from "@/pages/demande-detail";
import DemandeForm from "@/pages/demande-form";
import EmailsList from "@/pages/emails-list";

function Router() {
  return (
    <Switch>
      <Route path="/" component={EmailsList} />
      <Route path="/biens" component={BiensList} />
      <Route path="/biens/new" component={BienForm} />
      <Route path="/biens/search" component={BienSearch} />
      <Route path="/biens/:id/edit" component={BienForm} />
      <Route path="/biens/:id" component={BienDetail} />
      <Route path="/demandes" component={DemandesList} />
      <Route path="/demandes/new" component={DemandeForm} />
      <Route path="/demandes/:id/edit" component={DemandeForm} />
      <Route path="/demandes/:id" component={DemandeDetail} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
