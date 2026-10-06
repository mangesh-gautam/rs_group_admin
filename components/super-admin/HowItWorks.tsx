import { Icon } from "@/components/icons";

export type HowItWorksStep = { title: string; body: string };

type Props = {
  steps: HowItWorksStep[];
  securityNote: { title: string; body: string };
  tagline: string;
};

export function HowItWorks({ steps, securityNote, tagline }: Props) {
  return (
    <aside className="overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-b from-[#eef4fd] to-[#e3edfb] p-5 sm:p-6">
      <h2 className="flex items-center gap-3 text-lg font-semibold text-navy">
        <span className="grid size-10 place-items-center rounded-full bg-white text-brand shadow-sm">
          <Icon name="shieldCheck" className="size-6" />
        </span>
        How It Works
      </h2>

      <ol className="mt-6 space-y-7">
        {steps.map((step, i) => (
          <li key={step.title} className="relative flex gap-4">
            {i < steps.length - 1 && (
              <span className="absolute top-11 bottom-[-24px] left-[19px] w-px bg-blue-200" />
            )}
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-blue-100 font-semibold text-brand ring-4 ring-white/60">
              {i + 1}
            </span>
            <div>
              <p className="text-sm font-medium text-navy">{step.title}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
                {step.body}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-8 rounded-xl border border-white bg-white/80 p-5">
        <p className="flex items-center gap-3 text-base font-semibold text-navy">
          <span className="grid size-8 place-items-center rounded-full bg-brand-soft text-brand">
            <Icon name="lock" className="size-4" />
          </span>
          {securityNote.title}
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-slate-600">
          {securityNote.body}
        </p>
      </div>

      <div className="mt-6 flex flex-col items-center pb-2">
        <span className="grid size-20 place-items-center rounded-full bg-gradient-to-b from-blue-400 to-brand text-white shadow-lg shadow-brand/30 ring-8 ring-blue-100">
          <Icon name="lock" className="size-8" />
        </span>
        <p className="mt-4 -rotate-6 font-script text-2xl whitespace-nowrap text-navy sm:text-3xl">
          {tagline}
        </p>
        <span className="-mt-1 h-px w-40 -rotate-6 bg-navy/60" />
      </div>
    </aside>
  );
}
