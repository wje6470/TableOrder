import { HTMLAttributes } from "react";
import { cardClass } from "../lib/ui";

export default function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`${cardClass} ${className}`} {...props} />;
}
