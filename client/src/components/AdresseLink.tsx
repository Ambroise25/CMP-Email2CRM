interface AdresseLinkProps {
  adresse: string;
  codePostal: string;
  ville: string;
  className?: string;
}

export function AdresseLink({ adresse, codePostal, ville, className }: AdresseLinkProps) {
  const query = encodeURIComponent(`${adresse} ${codePostal} ${ville}`);
  const url = `https://earth.google.com/web/search/${query}`;

  const handleClick = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    if ("key" in e && e.key !== "Enter" && e.key !== " ") return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <span
      role="link"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleClick}
      className={`cursor-pointer hover:underline ${className ?? ""}`}
      data-testid="link-google-earth"
    >
      {adresse}
    </span>
  );
}
