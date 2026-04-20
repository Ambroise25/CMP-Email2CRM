import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { BienWithGestionnaire } from "@shared/schema";

interface BienComboboxProps {
  value: number | null | undefined;
  onChange: (value: number) => void;
  biens: BienWithGestionnaire[];
  disabled?: boolean;
  loading?: boolean;
  "data-testid"?: string;
}

export function BienCombobox({
  value,
  onChange,
  biens,
  disabled,
  loading,
  "data-testid": dataTestId,
}: BienComboboxProps) {
  const [open, setOpen] = React.useState(false);

  const selected = biens.find((b) => b.id === value);

  const getLabel = (b: BienWithGestionnaire) =>
    `${b.adresse} - ${b.codePostal} ${b.ville}`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || loading}
          data-testid={dataTestId}
          className="w-full justify-between font-normal"
        >
          <span className="truncate">
            {selected ? getLabel(selected) : "Selectionner un bien"}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Rechercher par adresse..." data-testid="input-bien-search" />
          <CommandList>
            {loading ? (
              <div className="p-2 text-center text-sm text-muted-foreground">Chargement...</div>
            ) : (
              <>
                <CommandEmpty>Aucun bien trouve.</CommandEmpty>
                <CommandGroup>
                  {biens.map((b) => (
                    <CommandItem
                      key={b.id}
                      value={getLabel(b)}
                      onSelect={() => {
                        onChange(b.id);
                        setOpen(false);
                      }}
                      data-testid={`option-bien-${b.id}`}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === b.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {getLabel(b)}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
