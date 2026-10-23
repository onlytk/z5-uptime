import { SITE, SUPPORT_EMAIL } from "../lib/config";
import Logo from "./Logo";

const LINK = "block text-muted hover:text-white";

export default function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-[1000px] flex-col gap-6 px-5 py-10 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-md">
          <a href={SITE} aria-label="zerofive home">
            <Logo />
          </a>
          <p className="mt-4 text-[13px] leading-relaxed text-dim">
            This page is hosted on GitHub, separate from our servers, so it keeps working when z5.gg doesn&apos;t. z5.gg is checked from outside about every 5 minutes, when
            GitHub runs the schedule; each part&apos;s state comes from the platform&apos;s own checks, which run every minute.
          </p>
        </div>
        <div className="flex gap-10 text-[13px]">
          <div className="space-y-2">
            <p className="text-dim">zerofive</p>
            <a className={LINK} href={SITE}>
              z5.gg
            </a>
            <a className={LINK} href={`${SITE}/docs`}>
              API docs
            </a>
            <a className={LINK} href={`${SITE}/status`}>
              Live checks
            </a>
          </div>
          <div className="space-y-2">
            <p className="text-dim">Help</p>
            <a className={LINK} href={`mailto:${SUPPORT_EMAIL}`}>
              {SUPPORT_EMAIL}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
