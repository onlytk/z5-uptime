import { SITE } from "../lib/config";
import { useScrolled } from "../lib/hooks";
import Logo from "./Logo";

export default function Header() {
  const scrolled = useScrolled();
  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 border-b transition-[background-color,border-color] duration-300 ${scrolled ? "border-white/[0.06] bg-page/75 backdrop-blur-xl" : "border-transparent"}`}
    >
      <div className="mx-auto flex h-14 max-w-[1000px] items-center justify-between px-5 md:h-16">
        <a href={SITE} aria-label="zerofive home" className="shrink-0">
          <Logo />
        </a>
        <a href={`${SITE}/signup`} className="btn-accent inline-flex h-8 items-center rounded-lg px-3 text-[13px] font-medium sm:h-9 sm:px-4">
          Get started
        </a>
      </div>
    </header>
  );
}
