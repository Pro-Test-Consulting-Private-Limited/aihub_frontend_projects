import { StaticImageData } from "next/image";
import { IconType } from "react-icons";
export interface NavSubItem {
  name: string;
  value: string;
  href: string;
}

export interface NavBarItem {
  name: string;
  href: string;
  value: string;
  icon: StaticImageData | IconType;
  activeHeight?: string;
  items: NavSubItem[];
}
