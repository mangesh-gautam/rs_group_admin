import { Icon } from "@/components/icons";

/** The account holder's photograph (data URL from the API), or a "No photo" placeholder — the photo is optional. */
export function HolderPhoto({ src, name, className }: { src: string | null; name: string; className: string }) {
  if (!src) {
    return (
      <span
        role="img"
        aria-label={`No photograph of ${name}`}
        className={`grid shrink-0 place-items-center border border-dashed border-slate-300 bg-slate-50 text-center text-[10px] text-slate-400 ${className}`}
      >
        <span>
          <Icon name="user" className="mx-auto size-1/2 min-h-5 min-w-5" />
          No photo
        </span>
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- data URL from the API
  return <img src={src} alt={`Photograph of ${name}`} className={`shrink-0 border border-slate-200 object-cover ${className}`} />;
}
