import Image from "next/image";
import Link from "next/link";
import logo from "@/Assets/png/Logo.png";

type LogoProps = {
  href?: string;
  /** Hide the "RS Group Society" wordmark, showing only the image. */
  compact?: boolean;
  /** Hide the wordmark on very narrow phones (< 360px) where the header is crowded. */
  hideWordmarkOnTiny?: boolean;
};

export function Logo({ href = "/", compact = false, hideWordmarkOnTiny = false }: LogoProps) {
  return (
    <Link href={href} className="flex min-w-0 items-center gap-2 sm:gap-3">
      <Image
        src={logo}
        alt="RS Group Society logo"
        priority
        className="h-9 w-auto sm:h-11"
      />
      {!compact && (
        <div className={`leading-tight whitespace-nowrap ${hideWordmarkOnTiny ? "max-[359px]:hidden" : ""}`}>
          <p className="text-base font-bold tracking-tight text-navy sm:text-lg">
            RS Group Society
          </p>
          <p className="text-[10px] font-medium text-slate-600 sm:text-[11px]">
            Secure <span className="mx-0.5">•</span> Grow{" "}
            <span className="mx-0.5">•</span> Build Together
          </p>
        </div>
      )}
    </Link>
  );
}
