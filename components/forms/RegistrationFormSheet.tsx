import Image from "next/image";
import type { ReactNode } from "react";
import logo from "@/Assets/png/Logo.png";

/**
 * The A4 "Account Holder Registration Form" sheet, laid out like the paper
 * form. Without `data` every field is an empty writing line (blank form for
 * handwritten completion); with `data` the lines carry the account's values
 * and the photograph is filled in. Signatures always stay empty.
 * Black / white / grayscale only.
 */

export type RegistrationFormData = {
  formNo: string;
  registrationNo: string; // account number
  name: string;
  fatherHusbandName: string | null;
  houseNo: string;
  address: string;
 
  city: string;
  state: string;
  pincode: string;
  dob: string; // as printed, e.g. 14/03/1988
  sex: string;
  mobile: string;
  alternateMobile: string | null;
  panNo: string;
  aadhaarNo: string;
  bankName: string | null;
  bankAccountNo: string | null;
  ifscCode: string | null;
  branch: string | null;
  amount: string; // as printed, e.g. ₹5,000
  email: string | null;
  nomineeName: string | null;
  nomineeAge: string | null;
  nomineeRelation: string | null;
  date: string; // date the account was opened, as printed
  sponsorName: string | null;
  sponsorMobile: string | null;
  sponsorId: string | null;
  photo: string | null; // data URL
};

/** Exact A4 sheet when printed; the screen view shows the same sheet on a grey desk. */
export const PRINT_CSS = `
@page { size: A4 portrait; margin: 0; }
@media print {
  html, body { background: #fff !important; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`;

export function RegistrationFormSheet({ data }: { data?: RegistrationFormData }) {
  const d = data;
  return (
    <article className="mx-auto box-border flex h-[297mm] w-[210mm] flex-col bg-white px-[11mm] py-[9mm] text-[10.5pt] leading-tight text-black shadow-xl print:shadow-none">
      {/* ---------------------------- Header ---------------------------- */}
      <header className="flex items-center gap-[5mm] border-b-[1.5pt] border-black pb-[3mm]">
        <Image src={logo} alt="R.S. Group Society logo" priority className="h-[20mm] w-auto mix-blend-multiply brightness-110 contrast-125 grayscale" />
        <div className="flex-1 text-center">
          <h1 className="text-[22pt] font-extrabold tracking-[0.06em]">R.S. GROUP SOCIETY</h1>
          <p className="mt-[1mm] text-[9pt] text-neutral-700">
            F-29, 1st Floor, Gopal Nagar, Kewal Park Main Road
            <br />
            (infront of Ramlila Ground) Azadpur, Delhi-110033
          </p>
        </div>
        {/* keeps the name centred against the logo */}
        <div className="w-[20mm]" aria-hidden />
      </header>

      <div className="mt-[3mm] flex gap-[10mm]">
        <Line label="Form No." value={d?.formNo} mono className="flex-1" />
        <Line label="Registration No." value={d?.registrationNo} mono className="flex-1" />
      </div>

      <h2 className="mx-auto mt-[4mm] bg-black px-[8mm] py-[1.8mm] text-[12.5pt] font-bold tracking-[0.12em] text-white">
        ACCOUNT HOLDER REGISTRATION FORM
      </h2>

      {/* ------------------- Section 1: account holder ------------------- */}
      <Section title="ACCOUNT HOLDER DETAILS" className="mt-[4mm]">
        <div className="flex gap-[5mm]">
          <div className="min-w-0 flex-1">
            <Line label="Name" value={d?.name} />
            <Line label="Father's / Husband's Name" value={d?.fatherHusbandName} />
            <Line label="Flat No. / Makan No." value={d?.houseNo} />
            <Line label="Address" value={d?.address} />
            <Row>
              <Line label="City" value={d?.city} className="flex-[1.3]" />
              <Line label="State" value={d?.state} className="flex-[1.3]" />
              <Line label="PIN Code" value={d?.pincode} className="flex-1" />
            </Row>
            <Row>
              <Line label="DOB" value={d?.dob} className="flex-[1.3]" />
              <Line label="Sex" value={d?.sex} className="flex-1" />
            </Row>
          </div>
          <div className="flex h-[45mm] w-[35mm] shrink-0 flex-col items-center justify-center overflow-hidden border border-black text-center text-[8.5pt] text-neutral-600">
            {d?.photo ? (
              // eslint-disable-next-line @next/next/no-img-element -- data URL from the API
              <img src={d.photo} alt={`Photograph of ${d.name}`} className="size-full object-cover" />
            ) : (
              <>
                <span className="font-semibold text-black">Photograph</span>
                <span className="mt-[1mm]">Passport size</span>
              </>
            )}
          </div>
        </div>
        <Row>
          <Line label="Mob." value={d?.mobile} className="flex-1" />
          <Line label="Alternate Mob." value={d?.alternateMobile} className="flex-1" />
        </Row>
        <Row>
          <Line label="PAN No." value={d?.panNo} mono className="flex-1" />
          <Line label="Aadhaar No." value={d?.aadhaarNo} mono className="flex-1" />
        </Row>
        <Row>
          <Line label="Bank Name" value={d?.bankName} className="flex-1" />
          <Line label="A/c No." value={d?.bankAccountNo} mono className="flex-1" />
        </Row>
        <Row>
          <Line label="IFSC Code" value={d?.ifscCode} mono className="flex-1" />
          <Line label="Branch" value={d?.branch} className="flex-1" />
        </Row>
        <Row>
          <Line label="Amount" value={d?.amount} className="flex-1" />
          <Line label="E-mail" value={d?.email} className="flex-1" />
        </Row>
        <Row>
          <Line label="Nominee Name" value={d?.nomineeName} className="flex-[2.2]" />
          <Line label="Age" value={d?.nomineeAge} className="flex-[0.7]" />
          <Line label="Relation" value={d?.nomineeRelation} className="flex-[1.2]" />
        </Row>
        <Row className="mt-[5mm]">
          <Line label="Member Signature" className="flex-[1.6]" />
          <Line label="Date" value={d?.date} className="flex-1" />
        </Row>
      </Section>

      {/* --------------------- Section 2: sponsor --------------------- */}
      <Section title="SPONSOR'S DETAIL" className="mt-[3mm]">
        <Row>
          <Line label="Sponsor Name" value={d?.sponsorName} className="flex-[1.6]" />
          <Line label="Mob." value={d?.sponsorMobile} className="flex-1" />
        </Row>
        <Row>
          <Line label="Sponsor ID" value={d?.sponsorId} className="flex-1" />
          <Line label="Sponsor Signature" className="flex-[1.3]" />
        </Row>
      </Section>

      {/* -------------------- Section 3: documents -------------------- */}
      <section className="mt-[3mm] border border-black px-[4mm] py-[2.5mm]">
        <h3 className="text-[10pt] font-bold underline underline-offset-2">
          Please attach the following documents with the Form
        </h3>
        <ol className="mt-[1.5mm] list-inside list-decimal space-y-[1mm] text-[9.5pt]">
          <li>2 Passport Size Photo</li>
          <li>PAN Card photocopy with self attested</li>
          <li>Aadhaar Card photocopy with self attested</li>
        </ol>
      </section>

      {/* ------------------- Section 4: office use ------------------- */}
      <section className="mt-[3mm] flex-1 border-[1.2pt] border-dashed border-black">
        <h3 className="bg-neutral-800 py-[1.4mm] text-center text-[10.5pt] font-bold tracking-[0.2em] text-white">
          OFFICE USE ONLY
        </h3>
        <div className="px-[4mm] pt-[1mm] pb-[2mm]">
          <Row>
            <Line label="Form No." value={d?.formNo} mono className="flex-1" />
            <Line label="Date" value={d?.date} className="flex-1" />
          </Row>
          <Line label="Member Name" value={d?.name} />
          <Line label="C/o" value={d?.fatherHusbandName} />
          <Row>
            <Line label="Mob." value={d?.mobile} className="flex-1" />
            <Line label="E-mail" value={d?.email} className="flex-[1.6]" />
          </Row>
          <div className="mt-[6mm] flex justify-end">
            <Line label="Authorise Signature" className="w-[85mm]" />
          </div>
        </div>
      </section>
    </article>
  );
}

/* ------------------------------ building blocks ------------------------------ */

function Section({ title, className = "", children }: { title: string; className?: string; children: ReactNode }) {
  return (
    <section className={`border border-black ${className}`}>
      <h3 className="border-b border-black bg-neutral-200 px-[4mm] py-[1.2mm] text-[10pt] font-bold tracking-[0.12em]">
        {title}
      </h3>
      <div className="px-[4mm] pt-[0.5mm] pb-[2mm]">{children}</div>
    </section>
  );
}

function Row({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`flex gap-[6mm] ${className}`}>{children}</div>;
}

/**
 * A label followed by a dotted writing line; a value (if any) is written on
 * the line. Long values are cut with "…" so the sheet stays one A4 page.
 */
function Line({
  label,
  value,
  mono,
  className = "",
}: {
  label?: string;
  value?: string | null;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex h-[7.6mm] min-w-0 items-end gap-[2mm] ${className}`}>
      {label && <span className="shrink-0 font-semibold whitespace-nowrap">{label}:</span>}
      <span className="relative mb-[0.6mm] min-w-0 flex-1 border-b border-dotted border-black">
        {value && (
          <span
            title={value}
            className={`absolute right-0 bottom-[0.4mm] left-[1mm] truncate text-[10pt] ${mono ? "font-mono" : ""}`}
          >
            {value}
          </span>
        )}
      </span>
    </div>
  );
}
