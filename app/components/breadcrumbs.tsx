import Link from "next/link";
import { dm_sans } from "../config/fonts";
import { Breadcrumb } from "../interfaces/common";
import RightIcon from "../../public/icons/chevron-right.svg";
import Image from "next/image";

export default function Breadcrumbs({
  breadcrumbs,
}: {
  breadcrumbs: Breadcrumb[];
}) {
  return (
    <nav aria-label="Breadcrumb" className="mb-[10px] block">
      <ol
        className={`flex items-center flex-wrap text-[16px] ${dm_sans.className}`}
      >
        {breadcrumbs.map((breadcrumb, index) => (
          <li
            key={index}
            aria-current={breadcrumb.active}
            className={`mb-[10px] ${
              breadcrumb.active
                ? "text-[#8664f2] font-medium"
                : "text-[#5E6066] dark:text-[#9ca3af]"
            }`}
          >
            {breadcrumb.active ? (
              <div>{breadcrumb.label}</div>
            ) : (
              <Link href={breadcrumb.href}>{breadcrumb.label}</Link>
            )}
            {index < breadcrumbs.length - 1 ? (
              <span className="mx-3 inline-block">
                <Image src={RightIcon} width={6.5} alt="right" className="dark:invert" />
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}