const SITE_URL = "https://akbarakma.com";

type SiteCreditProps = {
  /** Full byline for the header; the mobile tab row uses just the domain. */
  variant?: "byline" | "compact";
  className?: string;
};

export function SiteCredit({ variant = "byline", className = "" }: SiteCreditProps) {
  return (
    <a
      href={SITE_URL}
      target="_blank"
      rel="noopener"
      className={`whitespace-nowrap text-ink-muted/75 transition-colors duration-150 ease-out hover:text-ember focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember ${className}`}
    >
      {variant === "byline" ? (
        <>
          made by{" "}
          <span className="underline decoration-rule underline-offset-2">akbarakma.com</span>
        </>
      ) : (
        "akbarakma.com"
      )}
    </a>
  );
}
