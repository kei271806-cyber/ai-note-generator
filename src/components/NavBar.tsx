"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./NavBar.module.css";

const LINKS = [
  { href: "/",      label: "記事生成" },
  { href: "/memo",  label: "メモ変換" },
  { href: "/queue", label: "Queue" },
];

export default function NavBar() {
  const pathname = usePathname();
  return (
    <nav className={styles.nav}>
      <div className={styles.inner}>
        {LINKS.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={`${styles.link} ${pathname === href ? styles.linkActive : ""}`}
          >
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
